/**
 * Transactional email via Resend (https://resend.com) — plain HTTPS, no SDK.
 *
 * Env:
 *   RESEND_API_KEY   re_xxxxxxxx (from resend.com → API Keys). If missing, emails are skipped (logged only).
 *   MAIL_FROM        "Meri Seva Mera Sankalp <noreply@yourdomain.in>"  — must be a verified domain in Resend.
 *                    Default "onboarding@resend.dev" works only for sending to the Resend account owner's own email (testing).
 *   PORTAL_URL       public URL used in emails (default: Railway URL or http://localhost:3000)
 *
 * Every function resolves without throwing; failures are logged so registration never blocks on email.
 */
const API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.MAIL_FROM || "Meri Seva Mera Sankalp <onboarding@resend.dev>";
const PORTAL_URL = (process.env.PORTAL_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3000")).replace(/\/$/, "");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function send({ to, subject, html, text }) {
  if (!to) return { skipped: "no recipient" };
  if (!API_KEY) { console.log(`[mail] RESEND_API_KEY not set — skipped "${subject}" to ${to}`); return { skipped: "no api key" }; }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { console.error(`[mail] Resend error ${r.status}:`, data); return { error: data }; }
    console.log(`[mail] sent "${subject}" to ${to} (id ${data.id})`);
    return { id: data.id };
  } catch (e) {
    console.error("[mail] failed:", e.message);
    return { error: e.message };
  }
}

/** Sent right after a school registers. Never includes the password. */
function registrationEmail(school) {
  const name = school.name || school.userId;
  const where = [school.zoneName, school.state].filter(Boolean).join(", ");
  const subject = "Registration confirmed — Meri Seva, Mera Sankalp";
  const text = `Dear ${school.nodalOfficer || "Sir/Madam"},

${name}${where ? ` (${where})` : ""} has been registered on the Meri Seva, Mera Sankalp portal under Seva Sankalp Abhiyan 2026.

Login: ${PORTAL_URL}
User ID: ${school.userId}
(Use the password you chose during registration.)

Next steps:
1. Log in and submit your students' reels (vertical 9:16, up to 90 seconds) with theme, title and consent declaration.
2. Mark your best entries as "Shortlisted for District" before the school-level deadline.
3. District and State/UT juries take it from there.

For help, reply to this email.

Directorate of Education, Govt. of NCT of Delhi
Seva Sankalp Abhiyan · 17 September – 17 October 2026`;

  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1B2140">
    <div style="height:6px;background:linear-gradient(90deg,#E8711A 0 33%,#fff 33% 66%,#178A4C 66%)"></div>
    <div style="padding:24px 28px">
      <h2 style="margin:0 0 4px;color:#1D2B64">Meri Seva, Mera Sankalp</h2>
      <p style="margin:0 0 20px;color:#7C8199;font-size:13px;letter-spacing:.04em;text-transform:uppercase">Seva Sankalp Abhiyan · Directorate of Education, GNCTD</p>
      <p>Dear ${esc(school.nodalOfficer || "Sir/Madam")},</p>
      <p><b>${esc(name)}</b>${where ? ` (${esc(where)})` : ""} has been registered successfully on the student reel competition portal.</p>
      <table style="border-collapse:collapse;margin:16px 0;font-size:15px">
        <tr><td style="padding:6px 14px 6px 0;color:#7C8199">Portal</td><td><a href="${PORTAL_URL}" style="color:#C85E10">${PORTAL_URL}</a></td></tr>
        <tr><td style="padding:6px 14px 6px 0;color:#7C8199">User ID</td><td><b>${esc(school.userId)}</b></td></tr>
        <tr><td style="padding:6px 14px 6px 0;color:#7C8199">Password</td><td>the one you chose during registration</td></tr>
      </table>
      <p style="margin:18px 0 6px"><b>Next steps</b></p>
      <ol style="margin:0;padding-left:20px;line-height:1.6">
        <li>Log in and submit your students' reels (vertical 9:16, up to 90 seconds) with theme, title and the consent declaration.</li>
        <li>Mark your best entries as <b>Shortlisted for District</b> before the school-level deadline.</li>
        <li>District and State/UT juries take it from there — the best reels reach the Grand Showcase on 17 October 2026.</li>
      </ol>
      <p style="margin-top:22px"><a href="${PORTAL_URL}" style="background:#E8711A;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:700;display:inline-block">Open the portal</a></p>
      <p style="color:#7C8199;font-size:13px;margin-top:26px">For help, reply to this email.<br>Directorate of Education, Govt. of NCT of Delhi · Seva Sankalp Abhiyan · 17 September – 17 October 2026</p>
    </div>
  </div>`;
  return { subject, html, text };
}

async function sendRegistrationEmail(school) {
  if (!school.email) return { skipped: "no email" };
  return send({ to: school.email, ...registrationEmail(school) });
}

module.exports = { send, sendRegistrationEmail, PORTAL_URL };
