/**
 * Data store — a tiny JSON-file database.
 *
 * Everything the API needs from a database goes through the functions
 * exported here. To move to a real database later (Postgres / Supabase /
 * MongoDB), replace the bodies of these functions and keep the signatures —
 * nothing in server.js or the frontend has to change.
 *
 * Shape of data/db.json:
 *   { "schools": [ {...} ], "videos": [ {...} ] }
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

let db = { schools: [], videos: [], zoneSchools: {} }; // zoneSchools: { zoneId: [extra school names] }

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      db = { schools: parsed.schools || [], videos: parsed.videos || [], zoneSchools: parsed.zoneSchools || {} };
    } catch (e) {
      console.error("Could not read db.json, starting empty:", e.message);
    }
  }
}

let writeTimer = null;
function save() {
  // Debounce: many writes in a burst become one file write.
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE); // atomic replace
  }, 50);
}

const id = () => crypto.randomBytes(8).toString("hex");
const now = () => new Date().toISOString();

// ---------- Schools ----------
function findSchoolByUserId(userId) {
  return db.schools.find((s) => s.userId === userId) || null;
}
function findSchoolById(schoolId) {
  return db.schools.find((s) => s.id === schoolId) || null;
}
function createSchool(fields) {
  const school = { id: id(), createdAt: now(), ...fields };
  db.schools.push(school);
  save();
  return school;
}
function updateSchool(schoolId, patch) {
  const s = findSchoolById(schoolId);
  if (!s) return null;
  Object.assign(s, patch, { updatedAt: now() });
  save();
  return s;
}

// ---------- Zones ----------
const ZONES_FILE = path.join(__dirname, "..", "config", "zones.json");
function loadZoneSeed() {
  try { return JSON.parse(fs.readFileSync(ZONES_FILE, "utf8")).zones || []; }
  catch (e) { console.error("Could not read config/zones.json:", e.message); return []; }
}
/** Zones with their schools = seed list from config + schools that registered under that zone. */
function listZones() {
  return loadZoneSeed().map((z) => {
    const extra = db.zoneSchools[z.id] || [];
    const names = new Set([...(z.schools || []), ...extra].map((n) => n.trim()).filter(Boolean));
    return { ...z, schools: [...names].sort((a, b) => a.localeCompare(b)) };
  });
}
function findZone(zoneId) {
  return listZones().find((z) => z.id === zoneId) || null;
}
/** Remember a school name under a zone so it appears in the dropdown for the next school. */
function addSchoolToZone(zoneId, name) {
  if (!zoneId || !name) return;
  const list = db.zoneSchools[zoneId] || (db.zoneSchools[zoneId] = []);
  const exists = listZones().find((z) => z.id === zoneId)?.schools.some((n) => n.toLowerCase() === name.toLowerCase());
  if (!exists) { list.push(name); save(); }
}

// ---------- Videos / entries ----------
function listVideosForSchool(schoolId) {
  return db.videos
    .filter((v) => v.schoolId === schoolId)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}
function listAllVideos() {
  return db.videos.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}
function findVideo(videoId) {
  return db.videos.find((v) => v.id === videoId) || null;
}
function createVideo(fields) {
  const video = { id: id(), createdAt: now(), ...fields };
  db.videos.push(video);
  save();
  return video;
}
function updateVideo(videoId, patch) {
  const v = findVideo(videoId);
  if (!v) return null;
  Object.assign(v, patch, { updatedAt: now() });
  save();
  return v;
}
function deleteVideo(videoId) {
  const i = db.videos.findIndex((v) => v.id === videoId);
  if (i === -1) return null;
  const [removed] = db.videos.splice(i, 1);
  save();
  return removed;
}

load();

module.exports = {
  listZones,
  findZone,
  addSchoolToZone,
  findSchoolByUserId,
  findSchoolById,
  createSchool,
  updateSchool,
  listVideosForSchool,
  listAllVideos,
  findVideo,
  createVideo,
  updateVideo,
  deleteVideo,
};
