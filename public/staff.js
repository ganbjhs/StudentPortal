(function () {
  const $ = (id) => document.getElementById(id);
  let me = null, reels = [], zones = [], settings = { statuses: [], rubric: [] }, view = "reels";

  // ---------- helpers ----------
  const toast = (t) => { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2600); };
  const showMsg = (id, text) => { const el = $(id); if (!text) { el.hidden = true; return; } el.textContent = text; el.hidden = false; };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  async function api(method, url, body) {
    const opts = { method, headers: {} };
    if (body) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    const r = await fetch(url, opts);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    return data;
  }
  const statusLabel = (id) => (settings.statuses.find((x) => x.id === id) || {}).label || "Submitted";
  const roleLabel = (r) => ({ admin: "State Admin", district: "District Nodal Officer", judge: "Judge / Jury" }[r] || r);
  const classLabel = (c) => (/^\d+$/.test(c) ? "Class " + c : c);
  const fillZones = (sel, first) => { sel.innerHTML = `<option value="">${first}</option>`; const by = {}; zones.forEach((z) => (by[z.state || "Other"] ||= []).push(z)); Object.entries(by).forEach(([st, list]) => { const g = document.createElement("optgroup"); g.label = st; list.forEach((z) => g.appendChild(new Option(z.name, z.id))); sel.appendChild(g); }); };

  // ---------- auth ----------
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); showMsg("loginMsg", ""); $("loginBtn").disabled = true;
    try { const { user } = await api("POST", "/api/staff/login", { userId: $("lUser").value, password: $("lPass").value }); enter(user); }
    catch (err) { showMsg("loginMsg", err.message); } finally { $("loginBtn").disabled = false; }
  });
  $("logoutBtn").addEventListener("click", async () => { await api("POST", "/api/logout").catch(() => {}); location.reload(); });

  async function enter(user) {
    me = user;
    $("authView").hidden = true; $("dashView").hidden = false; $("who").hidden = false;
    $("whoName").textContent = user.name || user.userId;
    $("whoRole").textContent = [roleLabel(user.role), user.role === "judge" ? (user.level === "state" ? "State/UT level" : "District level") : "", user.zoneName].filter(Boolean).join(" · ");
    $("tabUsers").hidden = user.role !== "admin";
    $("tabReport").hidden = user.role === "judge";
    $("zoneFilter").hidden = user.role !== "admin" && user.level !== "state";
    $("rubricHint").textContent = user.role === "judge" || user.role === "admin"
      ? "Rubric: " + settings.rubric.map((c) => `${c.label} (${c.max})`).join(" · ") + " = 100"
      : "Forward the strongest reels of your district using the status control on each card.";
    await loadReels();
  }

  // ---------- tabs ----------
  document.querySelectorAll(".view-tabs .tab").forEach((t) => t.addEventListener("click", () => {
    view = t.dataset.view;
    document.querySelectorAll(".view-tabs .tab").forEach((x) => x.setAttribute("aria-selected", x === t));
    $("reelsView").hidden = view !== "reels"; $("reportView").hidden = view !== "report"; $("usersView").hidden = view !== "users";
    $("reelFilters").hidden = view !== "reels";
    if (view === "reels") loadReels(); if (view === "report") loadReport(); if (view === "users") loadUsers();
  }));
  ["zoneFilter", "statusFilter"].forEach((id) => $(id).addEventListener("change", loadReels));
  let st; $("search").addEventListener("input", () => { clearTimeout(st); st = setTimeout(loadReels, 250); });

  // ---------- reels ----------
  async function loadReels() {
    const p = new URLSearchParams();
    if ($("zoneFilter").value) p.set("zone", $("zoneFilter").value);
    if ($("statusFilter").value) p.set("status", $("statusFilter").value);
    if ($("search").value.trim()) p.set("q", $("search").value.trim());
    try { reels = (await api("GET", "/api/eval/reels?" + p)).reels; render(); await loadStats(); }
    catch (err) { toast(err.message); }
  }
  async function loadStats() {
    if (me.role === "judge") { $("stReels").textContent = reels.length; $("stSchools").textContent = new Set(reels.map((r) => r.schoolId)).size; $("stDistricts").textContent = new Set(reels.map((r) => r.zoneId)).size; $("stSelected").textContent = reels.filter((r) => r.scores.district?.judges?.some((j) => j.judgeId === me.id) || r.scores.state?.judges?.some((j) => j.judgeId === me.id)).length; document.querySelector("#stSelected + .l").textContent = "Scored by me"; return; }
    try { const s = await api("GET", "/api/admin/stats"); $("stReels").textContent = s.totals.reels; $("stSchools").textContent = s.totals.schools; $("stDistricts").textContent = s.totals.districts; $("stSelected").textContent = (s.byStatus.district_selected || 0) + (s.byStatus.state_selected || 0); } catch (_) {}
  }
  function render() {
    const grid = $("grid"); grid.innerHTML = ""; $("empty").hidden = reels.length > 0;
    const canScore = me.role === "judge" || me.role === "admin";
    const canStatus = me.role === "district" || me.role === "admin";
    const myLevel = me.role === "admin" ? "state" : me.level;
    reels.forEach((en) => {
      const card = document.createElement("article"); card.className = "card entry";
      let media;
      const isImage = en.mediaType === "image" || ((en.entryType && en.entryType !== "reel") && !!en.videoFile);
      if (en.videoFile && isImage) media = `<img src="${esc(en.videoFile)}" alt="${esc(en.caption || "Drawing")}" loading="lazy">`;
      else if (en.videoFile) media = `<video controls preload="metadata" src="${esc(en.videoFile)}"></video>`;
      else if (en.videoUrl) media = `<a class="ext" href="${esc(en.videoUrl)}" target="_blank" rel="noopener"><span class="play"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></span>Open entry<small>external link</small></a>`;
      else media = `<div class="novideo">No media</div>`;
      const chips = [];
      if (en.class || en.section) chips.push(`<span class="chip">${esc([en.class && classLabel(en.class), en.section].filter(Boolean).join(" – "))}</span>`);
      if (en.theme) chips.push(`<span class="chip theme">${esc(en.theme)}</span>`);
      chips.push(`<span class="chip status ${esc(en.status || "submitted")}">${esc(statusLabel(en.status || "submitted"))}</span>`);
      const consent = en.consentOriginal && en.consentParental && en.consentMusic;
      const mine = (en.scores[myLevel]?.judges || []).find((j) => j.judgeId === me.id);
      const scoreRows = settings.rubric.map((c) => `<label class="score-row"><span>${esc(c.label)} <small>/ ${c.max}</small></span><input class="input" type="number" min="0" max="${c.max}" data-crit="${c.id}" value="${mine ? mine.criteria[c.id] ?? "" : ""}"></label>`).join("");
      const summary = ["district", "state"].filter((l) => en.scores[l]).map((l) => `<span class="chip ok">${l === "district" ? "District" : "State"} avg ${en.scores[l].avg} · ${en.scores[l].count} judge${en.scores[l].count > 1 ? "s" : ""}</span>`).join(" ");
      card.innerHTML = `<div class="media">${media}</div>
        <div class="entry-body">
          <h3>${esc(en.caption || "Untitled reel")}</h3>
          <div class="school">${esc(en.schoolName)} · ${esc(en.zoneName)}</div>
          <div class="chips">${chips.join("")}</div>
          <dl class="meta">
            ${en.studentName ? `<dt>Student</dt><dd>${esc(en.studentName)}${en.rollNo ? ` (Roll ${esc(en.rollNo)})` : ""}</dd>` : ""}
            ${en.description ? `<dt>Message</dt><dd class="desc">${esc(en.description)}</dd>` : ""}
            ${en.durationSec ? `<dt>Duration</dt><dd class="desc">${esc(en.durationSec)} sec</dd>` : ""}
            <dt>Consent</dt><dd class="desc">${consent ? '<span class="chip ok">Declared ✓</span>' : '<span class="chip status">Pending</span>'}</dd>
            ${summary ? `<dt>Scores</dt><dd class="desc">${summary}</dd>` : ""}
          </dl>
          ${(en.scores[myLevel]?.judges || []).filter((j) => j.remarks).length ? `<details class="remarks"><summary>Judge remarks</summary>${(en.scores[myLevel].judges).filter((j) => j.remarks).map((j) => `<p><b>${esc(j.judgeName)}</b> (${j.total}): ${esc(j.remarks)}</p>`).join("")}</details>` : ""}
          ${canScore ? `<form class="scoreform"><div class="score-grid">${scoreRows}</div><textarea class="input" rows="2" placeholder="Remarks (optional)" data-remarks>${esc(mine ? mine.remarks : "")}</textarea><div class="actions"><button class="btn btn-primary btn-sm" type="submit">${mine ? "Update score" : "Save score"}</button><span class="hint total">Total: <b>${mine ? mine.total : 0}</b> / 100</span></div></form>` : ""}
          ${canStatus ? `<div class="statusctl"><label class="hint">Move to</label><select class="input" data-status>${settings.statuses.map((s) => `<option value="${s.id}" ${(en.status || "submitted") === s.id ? "selected" : ""} ${me.role === "district" && s.id === "state_selected" ? "disabled" : ""}>${esc(s.label)}</option>`).join("")}</select></div>` : ""}
        </div>`;
      const im = card.querySelector("img");
      if (im) im.addEventListener("load", () => { if (im.naturalHeight > im.naturalWidth) card.querySelector(".media").classList.add("portrait"); });
      const vid = card.querySelector("video");
      if (vid) vid.addEventListener("loadedmetadata", () => { if (vid.videoHeight >= vid.videoWidth) card.querySelector(".media").classList.add("portrait"); });
      const form = card.querySelector(".scoreform");
      if (form) {
        const recalc = () => { let t = 0; form.querySelectorAll("[data-crit]").forEach((i) => (t += Number(i.value) || 0)); form.querySelector(".total b").textContent = t; };
        form.addEventListener("input", recalc);
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const criteria = {}; form.querySelectorAll("[data-crit]").forEach((i) => (criteria[i.dataset.crit] = Number(i.value) || 0));
          try { await api("POST", `/api/eval/reels/${en.id}/score`, { criteria, remarks: form.querySelector("[data-remarks]").value, level: myLevel }); toast("Score saved ✓"); loadReels(); }
          catch (err) { toast(err.message); }
        });
      }
      const sel = card.querySelector("[data-status]");
      if (sel) sel.addEventListener("change", async () => {
        try { await api("POST", `/api/eval/reels/${en.id}/status`, { status: sel.value }); toast("Status updated: " + statusLabel(sel.value)); loadReels(); }
        catch (err) { toast(err.message); loadReels(); }
      });
      grid.appendChild(card);
    });
  }

  // ---------- report ----------
  async function loadReport() {
    try {
      const s = await api("GET", "/api/admin/stats");
      const tb = $("districtTable").querySelector("tbody"); tb.innerHTML = "";
      s.byDistrict.forEach((r) => { const tr = document.createElement("tr"); tr.innerHTML = `<td>${esc(r.district)}</td><td>${esc(r.state)}</td><td>${r.schools}</td><td>${r.reels}</td><td>${r.shortlisted}</td><td>${r.districtSelected}</td><td>${r.stateSelected}</td>`; tb.appendChild(tr); });
      if (!s.byDistrict.length) tb.innerHTML = `<tr><td colspan="7" class="hint">No participation yet.</td></tr>`;
      const dl = (id, obj, labeler) => { const el = $(id); el.innerHTML = Object.entries(obj).sort().map(([k, v]) => `<dt>${esc(labeler ? labeler(k) : k)}</dt><dd>${v}</dd>`).join("") || `<dt class="hint">—</dt><dd></dd>`; };
      dl("byStatus", s.byStatus, statusLabel); dl("byTheme", s.byTheme); dl("byDay", s.byDay);
    } catch (err) { toast(err.message); }
  }

  // ---------- users (admin) ----------
  $("uRole").addEventListener("change", () => { const r = $("uRole").value; $("uLevelField").hidden = r !== "judge"; $("uZoneField").hidden = r === "admin" || (r === "judge" && $("uLevel").value === "state"); });
  $("uLevel").addEventListener("change", () => $("uRole").dispatchEvent(new Event("change")));
  $("userForm").addEventListener("submit", async (e) => {
    e.preventDefault(); showMsg("userMsg", "");
    try {
      await api("POST", "/api/staff/users", { name: $("uName").value, role: $("uRole").value, level: $("uLevel").value, zoneId: $("uZone").value, email: $("uEmail").value, phone: $("uPhone").value, userId: $("uUser").value, password: $("uPass").value });
      toast("Login created ✓"); $("userForm").reset(); $("uRole").dispatchEvent(new Event("change")); loadUsers();
    } catch (err) { showMsg("userMsg", err.message); }
  });
  async function loadUsers() {
    try {
      const { users } = await api("GET", "/api/staff/users");
      const tb = $("userTable").querySelector("tbody"); tb.innerHTML = "";
      users.forEach((u) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${esc(u.name || "—")}</td><td>${esc(roleLabel(u.role))}</td><td>${u.role === "judge" ? (u.level === "state" ? "State/UT" : "District") : "—"}</td><td>${esc(u.zoneName || (u.role === "admin" ? "All" : "—"))}</td><td><code>${esc(u.userId)}</code></td><td>${esc([u.email, u.phone].filter(Boolean).join(" · "))}</td><td>${u.id !== me.id ? `<button class="link-btn danger" type="button">Remove</button>` : ""}</td>`;
        const del = tr.querySelector("button");
        if (del) del.addEventListener("click", async () => { if (!confirm(`Remove login for ${u.name || u.userId}?`)) return; try { await api("DELETE", `/api/staff/users/${u.id}`); loadUsers(); } catch (err) { toast(err.message); } });
        tb.appendChild(tr);
      });
    } catch (err) { toast(err.message); }
  }
  $("pwForm").addEventListener("submit", async (e) => { e.preventDefault(); try { await api("PUT", "/api/staff/me/password", { password: $("pwNew").value }); toast("Password updated ✓"); $("pwForm").reset(); } catch (err) { toast(err.message); } });

  // ---------- boot ----------
  (async () => {
    try { settings = await api("GET", "/api/settings"); zones = (await api("GET", "/api/zones")).zones; } catch (_) {}
    fillZones($("zoneFilter"), "All districts"); fillZones($("uZone"), "Select district");
    $("statusFilter").innerHTML = '<option value="">All statuses</option>' + settings.statuses.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join("");
    $("uRole").dispatchEvent(new Event("change"));
    try { const { user } = await api("GET", "/api/staff/me"); await enter(user); }
    catch (_) { $("authView").hidden = false; }
  })();
})();
