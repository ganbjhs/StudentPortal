(function () {
  const $ = (id) => document.getElementById(id);
  const CLASSES = ["Nursery","LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"];
  CLASSES.forEach((c) => { const o = document.createElement("option"); o.value = c; $("classList").appendChild(o); });

  let school = null, entries = [], pendingFile = null, zones = [];
  let settings = { themes: [], statuses: [{ id: "submitted", label: "Submitted" }], reelRules: {},
                   participantTypes: [], entryTypes: [] };

  // ---------- campaign settings → theme / status / category dropdowns ----------
  async function loadSettings() {
    try { settings = await api("GET", "/api/settings"); } catch (_) {}
    (settings.themes || []).forEach((t) => $("aTheme").appendChild(new Option(t, t)));
    (settings.statuses || []).forEach((st) => $("aStatus").appendChild(new Option(st.label, st.id)));
    (settings.participantTypes || []).forEach((p) => $("aPart").appendChild(new Option(p.label, p.id)));
    (settings.entryTypes || []).forEach((t) => {
      $("aType").appendChild(new Option(t.label, t.id));
      $("typeFilter").appendChild(new Option(t.label, t.id));
    });
    applyCategories();
  }
  const statusLabel = (id) => (settings.statuses.find((x) => x.id === id) || {}).label || "Submitted";
  const partType = (id) => (settings.participantTypes || []).find((x) => x.id === id) || (settings.participantTypes || [])[0] || { id: "student", label: "Student", nameLabel: "Student name" };
  const entryType = (id) => (settings.entryTypes || []).find((x) => x.id === id) || (settings.entryTypes || [])[0] || { id: "reel", label: "Reel (video)", accept: "video/*", hint: "" };

  // ---------- the form follows the two category dropdowns ----------
  function applyCategories() {
    const p = partType($("aPart").value), t = entryType($("aType").value);
    const teacher = p.id !== "student";
    // who: student → roll / class / section · teacher or faculty → designation
    $("lblName").textContent = p.nameLabel || (p.label + " name");
    $("aName").placeholder = teacher ? "e.g. Sunita Verma" : "Aarav Sharma";
    $("fldRoll").hidden = teacher;
    $("fldDesig").hidden = !teacher;
    $("fldClassRow").hidden = teacher;
    // what: reel → video + duration · drawing → image, no duration
    const drawing = t.id !== "reel";
    $("lblMedia").textContent = t.label;
    $("lblCaption").textContent = drawing ? "Artwork title / caption" : "Reel title / caption";
    $("lblDescHint").textContent = drawing ? "(what the drawing shows, in 2–3 lines)" : "(what the reel shows, in 2–3 lines)";
    $("fldDur").hidden = drawing;
    $("aFile").accept = t.accept || "video/*";
    $("dropText").textContent = drawing ? "Choose an image file" : "Choose a video file";
    if (!pendingFile) $("fname").textContent = drawing ? "JPG / PNG / WebP" : "MP4 / MOV / WebM";
    $("aLink").placeholder = drawing ? "Paste a Google Drive / image link" : "Paste a YouTube / Google Drive video link";
    $("formHint").textContent = t.hint || "";
    $("formTitle").textContent = $("editId").value ? "Edit entry" : `Submit a ${drawing ? "drawing" : "reel"} — ${p.label.toLowerCase()}`;
  }
  $("aPart").addEventListener("change", applyCategories);
  $("aType").addEventListener("change", applyCategories);

  // ---------- State/UT → District → School (hierarchical registration) ----------
  async function loadZones() {
    try { zones = (await api("GET", "/api/zones")).zones; } catch (_) { zones = []; }
    // State list: Delhi first (host state), then the rest alphabetically
    const states = [...new Set(zones.map((z) => z.state).filter(Boolean))].sort((a, b) => (a === "Delhi" ? -1 : b === "Delhi" ? 1 : a.localeCompare(b)));
    const sSel = $("rState"); sSel.innerHTML = '<option value="">Select State / UT</option>';
    states.forEach((st) => sSel.appendChild(new Option(st, st)));
    if (states.length === 1) { sSel.value = states[0]; fillDistricts(states[0]); } // single-state campaign: State is pre-filled
  }
  function fillDistricts(state) {
    const zSel = $("rZone");
    const list = zones.filter((z) => z.state === state);
    zSel.innerHTML = ""; zSel.disabled = !state;
    zSel.appendChild(new Option(state ? "Select district" : "Select State / UT first", ""));
    list.forEach((z) => zSel.appendChild(new Option(z.name, z.id)));
    fillSchools(""); $("rCity").value = "";
    if (list.length === 1) { zSel.value = list[0].id; fillSchools(list[0].id); } // single-district UTs: skip a step
  }
  // School name is a free-text field; the district's known schools are offered as suggestions.
  function fillSchools(zoneId) {
    const dl = $("schoolList"); const z = zones.find((x) => x.id === zoneId);
    dl.innerHTML = "";
    if (!z) { $("rCity").value = ""; $("rName").placeholder = "Start typing your school's name"; return; }
    $("rCity").value = z.city || "";
    z.schools.forEach((n) => dl.appendChild(new Option(n)));
    $("rName").placeholder = z.schools.length ? "Start typing — pick a suggestion or type your own" : "Type your school's full name";
  }
  $("rState").addEventListener("change", (e) => fillDistricts(e.target.value));
  $("rZone").addEventListener("change", (e) => fillSchools(e.target.value));

  // ---------- helpers ----------
  const toast = (t) => { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2600); };
  const showMsg = (id, text, ok) => { const el = $(id); if (!text) { el.hidden = true; return; } el.textContent = text; el.className = "msg " + (ok ? "ok" : "err"); el.hidden = false; };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  async function api(method, url, body) {
    const opts = { method, headers: {} };
    if (body instanceof FormData) opts.body = body;
    else if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  }
  const classLabel = (c) => (/^\d+$/.test(c) ? "Class " + c : c);

  // ---------- tabs ----------
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", x === t));
    $("loginForm").hidden = t.dataset.tab !== "login";
    $("regForm").hidden = t.dataset.tab !== "reg";
  }));

  // ---------- auth ----------
  $("regForm").addEventListener("submit", async (e) => {
    e.preventDefault(); showMsg("regMsg", "");
    if ($("rPass").value !== $("rPass2").value) return showMsg("regMsg", "Passwords do not match.");
    $("regBtn").disabled = true;
    try {
      const { school: s, emailSent } = await api("POST", "/api/register", {
        name: $("rName").value.trim(), zoneId: $("rZone").value,
        city: $("rCity").value, state: $("rState").value, nodalOfficer: $("rNodal").value, phone: $("rPhone").value,
        email: $("rEmail").value, schoolCode: $("rCode").value, udise: $("rUdise").value,
        userId: $("rUser").value, password: $("rPass").value,
      });
      enter(s); toast(emailSent ? "School registered 🎉 Confirmation email sent" : "School registered 🎉");
    } catch (err) { showMsg("regMsg", err.message); }
    finally { $("regBtn").disabled = false; }
  });

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); showMsg("loginMsg", "");
    $("loginBtn").disabled = true;
    try {
      const { school: s } = await api("POST", "/api/login", { userId: $("lUser").value, password: $("lPass").value });
      enter(s);
    } catch (err) { showMsg("loginMsg", err.message); }
    finally { $("loginBtn").disabled = false; }
  });

  $("logoutBtn").addEventListener("click", async () => { await api("POST", "/api/logout").catch(() => {}); leave(); });

  async function enter(s) {
    school = s;
    $("authView").hidden = true; $("dashView").hidden = false; $("who").hidden = false;
    $("whoName").textContent = s.name || s.userId;
    const sid = s.schoolCode || s.udise || s.userId;
    $("whoCity").textContent = [...new Set([sid ? "School ID " + sid : "", s.zoneName, s.state].filter(Boolean))].join(" · ");
    await loadEntries();
  }
  function leave() {
    school = null; entries = []; render();
    $("authView").hidden = false; $("dashView").hidden = true; $("who").hidden = true;
    $("loginForm").reset(); $("regForm").reset();
    loadZones().then(() => {
      const only = $("rState").options.length === 2 ? $("rState").options[1].value : "";
      $("rState").value = only; fillDistricts(only);
    });
  }
  // A school only sees its own entries — reels and drawings of its own students and teachers.
  async function loadEntries() {
    try { entries = (await api("GET", "/api/videos")).videos; render(); }
    catch (err) { toast(err.message); }
  }
  $("typeFilter").addEventListener("change", render);

  // ---------- video file pick / drag ----------
  const drop = $("drop");
  function setFile(f) {
    if (!f) return;
    const drawing = entryType($("aType").value).id !== "reel";
    const okType = drawing ? f.type.startsWith("image/") : f.type.startsWith("video/");
    if (!okType) return showMsg("addMsg", drawing ? "Please choose an image file (JPG, PNG, WebP) for a drawing." : "Please choose a video file (MP4, MOV, WebM) for a reel.");
    pendingFile = f;
    $("fname").textContent = `${f.name} · ${(f.size / 1048576).toFixed(1)} MB`;
    showMsg("addMsg", "");
  }
  $("aFile").addEventListener("change", (e) => setFile(e.target.files[0]));
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => setFile(e.dataTransfer.files[0]));

  function resetForm() {
    $("addForm").reset(); $("editId").value = ""; pendingFile = null;
    $("addBtn").textContent = "Submit"; $("cancelBtn").textContent = "Clear";
    $("aStatus").value = "submitted";
    applyCategories();
    showMsg("addMsg", "");
    document.querySelectorAll(".entry.editing").forEach((el) => el.classList.remove("editing"));
  }
  $("cancelBtn").addEventListener("click", resetForm);

  // ---------- save (create or update) with upload progress ----------
  $("addForm").addEventListener("submit", (e) => {
    e.preventDefault(); showMsg("addMsg", "");
    const editId = $("editId").value;
    const fd = new FormData();
    fd.append("participantType", $("aPart").value);
    fd.append("entryType", $("aType").value);
    fd.append("designation", $("aDesig").value);
    fd.append("studentName", $("aName").value);
    fd.append("rollNo", $("aRoll").value);
    fd.append("class", $("aClass").value);
    fd.append("section", $("aSec").value);
    fd.append("caption", $("aCaption").value);
    fd.append("description", $("aDesc").value);
    fd.append("theme", $("aTheme").value);
    fd.append("durationSec", $("aDur").value);
    fd.append("status", $("aStatus").value);
    fd.append("consentOriginal", $("cOriginal").checked);
    fd.append("consentParental", $("cParental").checked);
    fd.append("consentMusic", $("cMusic").checked);
    fd.append("videoUrl", $("aLink").value);
    if (pendingFile) fd.append("video", pendingFile);

    const hasAnything = ["studentName", "rollNo", "class", "section", "caption", "description", "theme", "designation", "videoUrl"].some((k) => String(fd.get(k) || "").trim()) || !!pendingFile;
    if (!hasAnything) return showMsg("addMsg", "Fill in at least one field or add a video.");

    const prog = $("prog"), bar = prog.querySelector("i");
    $("addBtn").disabled = true; prog.hidden = false; bar.style.width = "2%";

    const xhr = new XMLHttpRequest();
    xhr.open(editId ? "PUT" : "POST", editId ? `/api/videos/${editId}` : "/api/videos");
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) bar.style.width = Math.round((ev.loaded / ev.total) * 100) + "%"; };
    xhr.onload = () => {
      $("addBtn").disabled = false;
      let data = {}; try { data = JSON.parse(xhr.responseText); } catch (_) {}
      if (xhr.status >= 200 && xhr.status < 300) {
        toast(editId ? "Entry updated ✓" : "Entry submitted ✓"); resetForm(); loadEntries();
      } else showMsg("addMsg", data.error || "Could not save the entry.");
      setTimeout(() => { prog.hidden = true; bar.style.width = "0"; }, 500);
    };
    xhr.onerror = () => { $("addBtn").disabled = false; prog.hidden = true; showMsg("addMsg", "Network error — is the server running?"); };
    xhr.send(fd);
  });

  // ---------- edit / delete ----------
  function startEdit(en, card) {
    resetForm();
    $("editId").value = en.id;
    $("aPart").value = en.participantType || "student";
    $("aType").value = en.entryType || "reel";
    applyCategories();
    $("aDesig").value = en.designation || "";
    $("aName").value = en.studentName || ""; $("aRoll").value = en.rollNo || "";
    $("aClass").value = en.class || ""; $("aSec").value = en.section || "";
    $("aCaption").value = en.caption || ""; $("aDesc").value = en.description || "";
    $("aTheme").value = en.theme || "";
    $("aDur").value = en.durationSec || ""; $("aStatus").value = en.status || "submitted";
    $("cOriginal").checked = !!en.consentOriginal; $("cParental").checked = !!en.consentParental; $("cMusic").checked = !!en.consentMusic;
    $("aLink").value = en.videoUrl || "";
    if (en.videoFile) $("fname").textContent = `Current: ${en.originalName || "uploaded file"} (choose a file to replace)`;
    $("formTitle").textContent = "Edit entry"; $("addBtn").textContent = "Update"; $("cancelBtn").textContent = "Cancel";
    card.classList.add("editing");
    $("addCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function del(en) {
    if (!confirm(`Delete the entry by ${en.studentName || "this participant"}?`)) return;
    try { await api("DELETE", `/api/videos/${en.id}`); toast("Entry deleted"); loadEntries(); }
    catch (err) { toast(err.message); }
  }

  // ---------- render ----------
  $("search").addEventListener("input", render);
  function hostOf(u) { try { const h = new URL(u).hostname.replace(/^www\./, ""); return h.includes("youtu") ? "YouTube" : h.includes("google") ? "Google Drive" : h; } catch (_) { return "link"; } }
  function render() {
    const q = $("search").value.trim().toLowerCase();
    const typeF = $("typeFilter").value;
    const searchable = (e) => [
      e.caption, e.description, e.theme, e.studentName, e.designation, e.rollNo, e.class, e.section,
      e.schoolName, e.schoolCode, e.zoneName,
      statusLabel(e.status), entryType(e.entryType).label, partType(e.participantType).label,
    ].join(" ").toLowerCase();
    let list = entries;
    if (typeF) list = list.filter((e) => (e.entryType || "reel") === typeF);
    if (q) list = list.filter((e) => searchable(e).includes(q));

    $("stTotal").textContent = entries.length;
    $("stStudents").textContent = new Set(entries.map((e) => `${e.participantType || "student"}|${e.studentName}|${e.class}${e.section}|${e.rollNo}`.toLowerCase())).size;
    $("stShort").textContent = entries.filter((e) => e.status && e.status !== "submitted").length;

    const grid = $("grid"); grid.innerHTML = "";
    $("empty").hidden = list.length > 0;
    $("emptyTitle").textContent = q || typeF ? "No matching entries" : "No entries yet";

    list.forEach((en) => {
      const t = entryType(en.entryType), p = partType(en.participantType);
      const drawing = t.id !== "reel";
      const isImage = en.mediaType === "image" || (drawing && !!en.videoFile);
      const card = document.createElement("article"); card.className = "card entry";
      let media;
      if (en.videoFile && isImage) media = `<img src="${esc(en.videoFile)}" alt="${esc(en.caption || "Drawing")}" loading="lazy">`;
      else if (en.videoFile) media = `<video controls preload="metadata" src="${esc(en.videoFile)}"></video>`;
      else if (en.videoUrl) media = `<a class="ext" href="${esc(en.videoUrl)}" target="_blank" rel="noopener"><span class="play"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></span>Open ${drawing ? "drawing" : "video"}<small>${esc(hostOf(en.videoUrl))}</small></a>`;
      else media = `<div class="novideo">No ${drawing ? "drawing" : "video"} yet<small>Edit to add one</small></div>`;

      const chips = [];
      chips.push(`<span class="chip type ${esc(t.id)}">${esc(t.label)}</span>`);
      chips.push(`<span class="chip part">${esc(p.label)}</span>`);
      if (p.id === "student" && (en.class || en.section)) chips.push(`<span class="chip">${esc([en.class && classLabel(en.class), en.section].filter(Boolean).join(" – "))}</span>`);
      if (p.id === "student" && en.rollNo) chips.push(`<span class="chip roll">Roll No. ${esc(en.rollNo)}</span>`);
      if (en.theme) chips.push(`<span class="chip theme">${esc(en.theme)}</span>`);
      if (en.status && en.status !== "submitted") chips.push(`<span class="chip status ${esc(en.status)}">${esc(statusLabel(en.status))}</span>`);

      const own = school && en.schoolId === school.id;
      const when = en.createdAt ? new Date(en.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
      const sid = en.schoolCode ? `School ID ${en.schoolCode}` : "";
      card.innerHTML = `<div class="media">${media}</div>
        <div class="entry-body">
          <h3>${esc(en.caption || (drawing ? "Untitled drawing" : "Untitled reel"))}</h3>
          <div class="school">${esc([en.schoolName, sid].filter(Boolean).join(" · "))}</div>
          ${chips.length ? `<div class="chips">${chips.join("")}</div>` : ""}
          <dl class="meta">
            ${en.studentName ? `<dt>${esc(p.id === "student" ? "Student" : "Teacher")}</dt><dd>${esc(en.studentName)}${en.designation ? " — " + esc(en.designation) : ""}</dd>` : ""}
            ${en.description ? `<dt>Message</dt><dd class="desc">${esc(en.description)}</dd>` : ""}
            ${!drawing && en.durationSec ? `<dt>Reel</dt><dd class="desc">${esc(en.durationSec)} sec</dd>` : ""}
            <dt>Consent</dt><dd class="desc">${en.consentOriginal && en.consentParental && en.consentMusic ? '<span class="chip ok">Declared ✓</span>' : [en.consentOriginal ? "original" : "", en.consentParental ? "parental" : "", en.consentMusic ? "music" : ""].filter(Boolean).join(", ") || "Pending"}</dd>
          </dl>
          <div class="entry-foot"><span>Submitted ${esc(when)}</span>
            ${own ? `<span class="links"><button class="link-btn" type="button" data-act="edit">Edit</button><button class="link-btn danger" type="button" data-act="del">Delete</button></span>` : ""}</div>
        </div>`;
      const vid = card.querySelector("video");
      if (vid) vid.addEventListener("loadedmetadata", () => {
        if (vid.videoHeight >= vid.videoWidth) card.querySelector(".media").classList.add("portrait");
      });
      const img = card.querySelector("img");
      if (img) img.addEventListener("load", () => {
        if (img.naturalHeight > img.naturalWidth) card.querySelector(".media").classList.add("portrait");
      });
      if (own) {
        card.querySelector('[data-act="edit"]').addEventListener("click", () => startEdit(en, card));
        card.querySelector('[data-act="del"]').addEventListener("click", () => del(en));
      }
      grid.appendChild(card);
    });
  }

  // ---------- boot: restore session ----------
  (async () => {
    await Promise.all([loadZones(), loadSettings()]);
    try { const { school: s } = await api("GET", "/api/me"); await enter(s); }
    catch (_) { $("authView").hidden = false; }
  })();
})();
