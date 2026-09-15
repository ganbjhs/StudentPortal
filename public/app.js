(function () {
  const $ = (id) => document.getElementById(id);
  const CLASSES = ["Nursery","LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"];
  CLASSES.forEach((c) => { const o = document.createElement("option"); o.value = c; $("classList").appendChild(o); });

  let school = null, entries = [], pendingFile = null, zones = [], view = "mine";
  let settings = { themes: [], languages: [], statuses: [{ id: "submitted", label: "Submitted" }], reelRules: {} };
  const OTHER = "__other__";

  // ---------- campaign settings → theme / language / status dropdowns ----------
  async function loadSettings() {
    try { settings = await api("GET", "/api/settings"); } catch (_) {}
    (settings.themes || []).forEach((t) => $("aTheme").appendChild(new Option(t, t)));
    (settings.languages || []).forEach((l) => $("aLang").appendChild(new Option(l, l)));
    (settings.statuses || []).forEach((st) => $("aStatus").appendChild(new Option(st.label, st.id)));
  }
  const statusLabel = (id) => (settings.statuses.find((x) => x.id === id) || {}).label || "Submitted";

  // ---------- State/UT → District → School (hierarchical registration) ----------
  async function loadZones() {
    try { zones = (await api("GET", "/api/zones")).zones; } catch (_) { zones = []; }
    // State list: Delhi first (host state), then the rest alphabetically
    const states = [...new Set(zones.map((z) => z.state).filter(Boolean))].sort((a, b) => (a === "Delhi" ? -1 : b === "Delhi" ? 1 : a.localeCompare(b)));
    const sSel = $("rState"); sSel.innerHTML = '<option value="">Select State / UT</option>';
    states.forEach((st) => sSel.appendChild(new Option(st, st)));
    // "All districts" filter on the dashboard, grouped by state
    const zf = $("zoneFilter"); zf.innerHTML = '<option value="">All districts</option>';
    states.forEach((st) => { const g = document.createElement("optgroup"); g.label = st; zones.filter((z) => z.state === st).forEach((z) => g.appendChild(new Option(z.name, z.id))); zf.appendChild(g); });
  }
  function fillDistricts(state) {
    const zSel = $("rZone"), sSel = $("rSchool");
    const list = zones.filter((z) => z.state === state);
    zSel.innerHTML = ""; zSel.disabled = !state;
    zSel.appendChild(new Option(state ? "Select district" : "Select State / UT first", ""));
    list.forEach((z) => zSel.appendChild(new Option(z.name, z.id)));
    sSel.innerHTML = '<option value="">Select district first</option>'; sSel.disabled = true; $("rCity").value = "";
    if (list.length === 1) { zSel.value = list[0].id; fillSchools(list[0].id); } // single-district UTs: skip a step
  }
  function fillSchools(zoneId) {
    const sSel = $("rSchool"); const z = zones.find((x) => x.id === zoneId);
    sSel.innerHTML = ""; sSel.disabled = !z;
    if (!z) { sSel.appendChild(new Option("Select district first", "")); $("rCity").value = ""; return; }
    $("rCity").value = z.city || "";
    sSel.appendChild(new Option(z.schools.length ? "Select your school" : "No schools listed yet — type the name below", ""));
    z.schools.forEach((n) => sSel.appendChild(new Option(n, n)));
    sSel.appendChild(new Option("My school is not listed (type name below)", OTHER));
    if (!z.schools.length) sSel.value = OTHER;
  }
  $("rState").addEventListener("change", (e) => fillDistricts(e.target.value));
  $("rZone").addEventListener("change", (e) => fillSchools(e.target.value));
  $("rSchool").addEventListener("change", (e) => { if (e.target.value === OTHER) $("rName").focus(); });

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
      const pick = $("rSchool").value;
      const { school: s } = await api("POST", "/api/register", {
        name: pick && pick !== OTHER ? pick : $("rName").value.trim(), zoneId: $("rZone").value,
        city: $("rCity").value, state: $("rState").value, nodalOfficer: $("rNodal").value, phone: $("rPhone").value,
        email: $("rEmail").value, udise: $("rUdise").value, userId: $("rUser").value, password: $("rPass").value,
      });
      enter(s); toast("School registered 🎉");
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
    $("whoCity").textContent = [...new Set([s.zoneName, s.city, s.state].filter(Boolean))].concat(s.userId).join(" · ");
    await loadEntries();
  }
  function leave() {
    school = null; entries = []; render();
    $("authView").hidden = false; $("dashView").hidden = true; $("who").hidden = true;
    $("loginForm").reset(); $("regForm").reset(); fillDistricts("");
  }
  async function loadEntries() {
    try {
      if (view === "mine") entries = (await api("GET", "/api/videos")).videos;
      else {
        const p = new URLSearchParams(); if ($("zoneFilter").value) p.set("zone", $("zoneFilter").value);
        entries = (await api("GET", "/api/videos/all?" + p)).videos;
      }
      render();
    } catch (err) { toast(err.message); }
  }
  // My school / All entries switch
  document.querySelectorAll(".view-tabs .tab").forEach((t) => t.addEventListener("click", () => {
    view = t.dataset.view;
    document.querySelectorAll(".view-tabs .tab").forEach((x) => x.setAttribute("aria-selected", x === t));
    $("zoneFilter").hidden = view !== "all";
    $("addCard").hidden = view !== "mine";
    loadEntries();
  }));
  $("zoneFilter").addEventListener("change", loadEntries);

  // ---------- video file pick / drag ----------
  const drop = $("drop");
  function setFile(f) {
    if (!f) return;
    if (!f.type.startsWith("video/")) return showMsg("addMsg", "Please choose a video file (MP4, MOV, WebM).");
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
    $("fname").textContent = "MP4 / MOV / WebM";
    $("formTitle").textContent = "Submit a student reel";
    $("addBtn").textContent = "Submit reel"; $("cancelBtn").textContent = "Clear";
    $("aStatus").value = "submitted";
    showMsg("addMsg", "");
    document.querySelectorAll(".entry.editing").forEach((el) => el.classList.remove("editing"));
  }
  $("cancelBtn").addEventListener("click", resetForm);

  // ---------- save (create or update) with upload progress ----------
  $("addForm").addEventListener("submit", (e) => {
    e.preventDefault(); showMsg("addMsg", "");
    const editId = $("editId").value;
    const fd = new FormData();
    fd.append("studentName", $("aName").value);
    fd.append("rollNo", $("aRoll").value);
    fd.append("class", $("aClass").value);
    fd.append("section", $("aSec").value);
    fd.append("caption", $("aCaption").value);
    fd.append("description", $("aDesc").value);
    fd.append("theme", $("aTheme").value);
    fd.append("language", $("aLang").value);
    fd.append("durationSec", $("aDur").value);
    fd.append("status", $("aStatus").value);
    fd.append("consentOriginal", $("cOriginal").checked);
    fd.append("consentParental", $("cParental").checked);
    fd.append("consentMusic", $("cMusic").checked);
    fd.append("videoUrl", $("aLink").value);
    if (pendingFile) fd.append("video", pendingFile);

    const hasAnything = ["studentName", "rollNo", "class", "section", "caption", "description", "theme", "videoUrl"].some((k) => String(fd.get(k) || "").trim()) || !!pendingFile;
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
        toast(editId ? "Reel updated ✓" : "Reel submitted ✓"); resetForm(); loadEntries();
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
    $("aName").value = en.studentName || ""; $("aRoll").value = en.rollNo || "";
    $("aClass").value = en.class || ""; $("aSec").value = en.section || "";
    $("aCaption").value = en.caption || ""; $("aDesc").value = en.description || "";
    $("aTheme").value = en.theme || ""; $("aLang").value = en.language || "";
    $("aDur").value = en.durationSec || ""; $("aStatus").value = en.status || "submitted";
    $("cOriginal").checked = !!en.consentOriginal; $("cParental").checked = !!en.consentParental; $("cMusic").checked = !!en.consentMusic;
    $("aLink").value = en.videoUrl || "";
    if (en.videoFile) $("fname").textContent = `Current: ${en.originalName || "uploaded video"} (choose a file to replace)`;
    $("formTitle").textContent = "Edit reel"; $("addBtn").textContent = "Update reel"; $("cancelBtn").textContent = "Cancel";
    card.classList.add("editing");
    $("addCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function del(en) {
    if (!confirm(`Delete the reel by ${en.studentName || "this student"}?`)) return;
    try { await api("DELETE", `/api/videos/${en.id}`); toast("Reel deleted"); loadEntries(); }
    catch (err) { toast(err.message); }
  }

  // ---------- render ----------
  $("search").addEventListener("input", render);
  function hostOf(u) { try { const h = new URL(u).hostname.replace(/^www\./, ""); return h.includes("youtu") ? "YouTube" : h.includes("google") ? "Google Drive" : h; } catch (_) { return "link"; } }
  function render() {
    const q = $("search").value.trim().toLowerCase();
    const list = q ? entries.filter((e) => [e.caption, e.description, e.theme, e.studentName, e.rollNo, e.class, e.section, e.schoolName, e.zoneName, statusLabel(e.status)].join(" ").toLowerCase().includes(q)) : entries;
    $("stTotal").textContent = entries.length;
    $("stStudents").textContent = new Set(entries.map((e) => `${e.schoolId}|${e.studentName}|${e.class}${e.section}|${e.rollNo}`.toLowerCase())).size;
    $("stShort").textContent = entries.filter((e) => e.status && e.status !== "submitted").length;
    const mine = view === "mine";
    document.querySelector("#stTotal + .l").textContent = mine ? "Reels submitted" : "Reels (all schools)";
    const grid = $("grid"); grid.innerHTML = "";
    $("empty").hidden = list.length > 0;
    $("emptyTitle").textContent = q ? "No matching reels" : "No reels yet";

    list.forEach((en) => {
      const card = document.createElement("article"); card.className = "card entry";
      let media;
      if (en.videoFile) media = `<video controls preload="metadata" src="${esc(en.videoFile)}"></video>`;
      else if (en.videoUrl) media = `<a class="ext" href="${esc(en.videoUrl)}" target="_blank" rel="noopener"><span class="play"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></span>Open video<small>${esc(hostOf(en.videoUrl))}</small></a>`;
      else media = `<div class="novideo">No video yet<small>Edit to add one</small></div>`;
      const chips = [];
      if (en.class || en.section) chips.push(`<span class="chip">${esc([en.class && classLabel(en.class), en.section].filter(Boolean).join(" – "))}</span>`);
      if (en.rollNo) chips.push(`<span class="chip roll">Roll No. ${esc(en.rollNo)}</span>`);
      if (en.theme) chips.push(`<span class="chip theme">${esc(en.theme)}</span>`);
      if (!mine && en.zoneName) chips.push(`<span class="chip zone">${esc(en.zoneName)}</span>`);
      if (en.status && en.status !== "submitted") chips.push(`<span class="chip status ${esc(en.status)}">${esc(statusLabel(en.status))}</span>`);
      const own = school && en.schoolId === school.id;
      const when = en.createdAt ? new Date(en.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
      card.innerHTML = `<div class="media">${media}</div>
        <div class="entry-body">
          <h3>${esc(en.caption || "Untitled reel")}</h3>
          ${!mine && en.schoolName ? `<div class="school">${esc(en.schoolName)}</div>` : ""}
          ${chips.length ? `<div class="chips">${chips.join("")}</div>` : ""}
          <dl class="meta">
            ${en.studentName ? `<dt>Student</dt><dd>${esc(en.studentName)}</dd>` : ""}
            ${en.description ? `<dt>Message</dt><dd class="desc">${esc(en.description)}</dd>` : ""}
            ${en.language || en.durationSec ? `<dt>Reel</dt><dd class="desc">${esc([en.language, en.durationSec ? en.durationSec + " sec" : ""].filter(Boolean).join(" · "))}</dd>` : ""}
            <dt>Consent</dt><dd class="desc">${en.consentOriginal && en.consentParental && en.consentMusic ? '<span class="chip ok">Declared ✓</span>' : [en.consentOriginal ? "original" : "", en.consentParental ? "parental" : "", en.consentMusic ? "music" : ""].filter(Boolean).join(", ") || "Pending"}</dd>
          </dl>
          <div class="entry-foot"><span>Submitted ${esc(when)}</span>
            ${own ? `<span class="links"><button class="link-btn" type="button" data-act="edit">Edit</button><button class="link-btn danger" type="button" data-act="del">Delete</button></span>` : ""}</div>
        </div>`;
      const vid = card.querySelector("video");
      if (vid) vid.addEventListener("loadedmetadata", () => {
        if (vid.videoHeight >= vid.videoWidth) card.querySelector(".media").classList.add("portrait");
      });
      if (own) {
        card.querySelector('[data-act="edit"]').addEventListener("click", () => { if (!mine) return toast("Switch to \"My school's reels\" to edit."); startEdit(en, card); });
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
