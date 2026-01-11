export default async function handler(req, res) {
  try {
    const want = String(process.env.DIAGNOSTICS_TOKEN || "");
    const got = String(req.query?.token || "");

    // Hide endpoint if not authorized (same behavior as diagnostics)
    if (!want || got !== want) {
      return res.status(404).send("Not found");
    }

    const token = got; // token comes from querystring
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>UPMEME Diagnostics</title>
  <style>
    :root{
      --bg:#0b1020;
      --panel:#0f1733;
      --panel2:#0c132b;
      --text:#e8ecff;
      --muted:#a9b3da;
      --line:rgba(255,255,255,.08);
      --ok:#22c55e;
      --warn:#f59e0b;
      --bad:#ef4444;
      --info:#60a5fa;
      --chip:#121c3e;
      --shadow: 0 20px 70px rgba(0,0,0,.35);
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
      --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    }
    body{ margin:0; background: radial-gradient(1200px 700px at 20% 0%, rgba(96,165,250,.12), transparent 60%),
                           radial-gradient(900px 600px at 90% 10%, rgba(34,197,94,.10), transparent 55%),
                           var(--bg);
          color:var(--text); font-family:var(--sans); }
    .wrap{ max-width:1100px; margin:40px auto; padding:0 16px; }
    header{ display:flex; gap:16px; align-items:flex-start; justify-content:space-between; margin-bottom:18px; }
    h1{ margin:0; font-size:22px; letter-spacing:.2px; }
    .sub{ margin-top:6px; color:var(--muted); font-size:13px; }
    .actions{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
    button{ border:1px solid var(--line); background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
            color:var(--text); padding:10px 12px; border-radius:12px; cursor:pointer; box-shadow:0 10px 30px rgba(0,0,0,.25);
            font-size:13px; }
    button:hover{ border-color:rgba(255,255,255,.18); }
    .pill{ display:inline-flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--line);
           background:rgba(255,255,255,.03); border-radius:999px; font-size:12px; color:var(--muted); }
    .dot{ width:8px; height:8px; border-radius:999px; background:var(--muted); }
    .dot.ok{ background:var(--ok); }
    .dot.warn{ background:var(--warn); }
    .dot.bad{ background:var(--bad); }
    .dot.info{ background:var(--info); }

    .grid{ display:grid; grid-template-columns: 1.2fr .8fr; gap:14px; }
    @media (max-width: 900px){ .grid{ grid-template-columns:1fr; } }

    .card{ background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
           border:1px solid var(--line); border-radius:18px; box-shadow:var(--shadow); overflow:hidden; }
    .card h2{ margin:0; padding:14px 14px 0 14px; font-size:14px; color:var(--muted); font-weight:600; letter-spacing:.3px; text-transform:uppercase; }
    .card .body{ padding:14px; }

    table{ width:100%; border-collapse:collapse; font-size:13px; }
    td, th{ padding:10px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
    th{ color:var(--muted); font-weight:600; text-align:left; background:rgba(0,0,0,.12); }
    tr:last-child td{ border-bottom:none; }
    .k{ color:var(--muted); width:44%; }
    .v{ font-family:var(--mono); }
    .badge{ display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:600;
            border:1px solid var(--line); background:rgba(255,255,255,.03); }
    .badge.ok{ color:var(--ok); border-color:rgba(34,197,94,.35); background:rgba(34,197,94,.08); }
    .badge.bad{ color:var(--bad); border-color:rgba(239,68,68,.35); background:rgba(239,68,68,.08); }
    .badge.warn{ color:var(--warn); border-color:rgba(245,158,11,.35); background:rgba(245,158,11,.08); }
    .badge.info{ color:var(--info); border-color:rgba(96,165,250,.35); background:rgba(96,165,250,.08); }

    .muted{ color:var(--muted); }
    .mono{ font-family:var(--mono); }
    pre{ margin:0; padding:12px; border-radius:14px; border:1px solid var(--line); background:rgba(0,0,0,.20);
         color:var(--text); overflow:auto; font-size:12px; line-height:1.4; }
    .footer{ margin-top:14px; color:var(--muted); font-size:12px; }
    .row{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between; margin-top:8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>UPMEME Diagnostics</h1>
        <div class="sub">Readable health view for Aiven (social) and future integrations. Token is required via <span class="mono">?token=</span>.</div>
        <div class="row">
          <span id="overall" class="pill"><span class="dot info"></span><span>Loading…</span></span>
          <span class="pill"><span class="dot info"></span><span class="mono" id="ts">—</span></span>
          <span class="pill"><span class="dot info"></span><span class="mono" id="nodeEnv">—</span></span>
        </div>
      </div>
      <div class="actions">
        <button id="refreshBtn">Refresh</button>
        <button id="copyBtn">Copy JSON</button>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <h2>Core status</h2>
        <div class="body">
          <table>
            <thead>
              <tr><th>Component</th><th>Status</th><th>Details</th></tr>
            </thead>
            <tbody id="coreRows">
              <tr><td class="k">Aiven Postgres</td><td>Loading…</td><td class="muted">Checking connectivity + schema…</td></tr>
              <tr><td class="k">Environment presence</td><td>Loading…</td><td class="muted">Checking key vars exist (no secrets)…</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>Recommendations</h2>
        <div class="body">
          <div id="recs" class="muted">Loading…</div>
        </div>
      </div>

      <div class="card" style="grid-column: 1 / -1;">
        <h2>Environment summary</h2>
        <div class="body">
          <table>
            <thead><tr><th>Key</th><th>Present</th><th>Extra</th></tr></thead>
            <tbody id="envRows"></tbody>
          </table>
        </div>
      </div>

      <div class="card" style="grid-column: 1 / -1;">
        <h2>Raw JSON</h2>
        <div class="body">
          <pre id="raw">Loading…</pre>
          <div class="footer">This page intentionally never displays secrets. If you add more checks, keep them redacted.</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const TOKEN = ${JSON.stringify(token)};
    let lastJson = null;

    function badge(status, label) {
      const cls = status === "ok" ? "ok" : status === "bad" ? "bad" : status === "warn" ? "warn" : "info";
      return '<span class="badge ' + cls + '"><span class="dot ' + cls + '"></span>' + label + '</span>';
    }

    function fmtBool(b){ return b ? badge("ok","Yes") : badge("bad","No"); }

    function setOverall(ok) {
      const el = document.getElementById("overall");
      if (!el) return;
      el.innerHTML = ok
        ? '<span class="dot ok"></span><span>Overall: OK</span>'
        : '<span class="dot bad"></span><span>Overall: Issues detected</span>';
    }

    function setCoreRows(j) {
      const tbody = document.getElementById("coreRows");
      const aiven = j?.checks?.aiven_postgres;

      const aivenStatus = aiven?.ok ? badge("ok","OK") : badge("bad","FAIL");
      const aivenDetails = aiven?.ok
        ? ('Latency: <span class="mono">' + (aiven.latencyMs ?? "—") + 'ms</span>, SSL: <span class="mono">' +
           (aiven.ssl?.rejectUnauthorized ? "verified" : "unverified") + '</span>')
        : ('<span class="mono">' + (aiven?.error?.code || "") + '</span> ' + (aiven?.error?.message || "Unknown error"));

      const envPresence = j?.env_presence || {};
      const required = ["DATABASE_URL","repo_aiven_ca_pem"];
      const missing = required.filter(k => {
        if (k === "repo_aiven_ca_pem") return !envPresence.repo_aiven_ca_pem?.exists;
        return !envPresence[k];
      });
      const envStatus = missing.length === 0 ? badge("ok","OK") : badge("warn","Missing");
      const envDetails = missing.length === 0 ? "Required env present." : ("Missing: <span class='mono'>" + missing.join(", ") + "</span>");

      tbody.innerHTML = ''
        + '<tr><td class="k">Aiven Postgres</td><td>' + aivenStatus + '</td><td>' + aivenDetails + '</td></tr>'
        + '<tr><td class="k">Environment presence</td><td>' + envStatus + '</td><td>' + envDetails + '</td></tr>';
    }

    function setEnvRows(j) {
      const tbody = document.getElementById("envRows");
      const e = j?.env_presence || {};
      const rows = [
        ["DATABASE_URL", !!e.DATABASE_URL, j?.redacted?.DATABASE_URL_host ? ("host: " + j.redacted.DATABASE_URL_host) : ""],
        ["PG_CA_CERT_B64", !!e.PG_CA_CERT_B64, ""],
        ["PG_CA_CERT", !!e.PG_CA_CERT, ""],
        ["repo aiven-ca.pem", !!e.repo_aiven_ca_pem?.exists, e.repo_aiven_ca_pem?.exists ? ("bytes: " + e.repo_aiven_ca_pem.bytes) : ""],
        ["SUPABASE_URL", !!e.SUPABASE_URL, ""],
        ["SUPABASE_SERVICE_ROLE_KEY", !!e.SUPABASE_SERVICE_ROLE_KEY, ""],
        ["ABLY_API_KEY", !!e.ABLY_API_KEY, ""],
        ["VITE_ABLY_CLIENT_KEY (server presence)", !!e.VITE_ABLY_CLIENT_KEY_on_server, "build-time var (client)"],
      ];

      tbody.innerHTML = rows.map(([k,p,extra]) => (
        '<tr>'
        + '<td class="k">' + k + '</td>'
        + '<td>' + (p ? badge("ok","Present") : badge("bad","Missing")) + '</td>'
        + '<td class="muted">' + (extra || "—") + '</td>'
        + '</tr>'
      )).join("");
    }

    function setRecommendations(j) {
      const el = document.getElementById("recs");
      const recs = Array.isArray(j?.recommendations) ? j.recommendations : [];
      if (recs.length === 0) {
        el.innerHTML = badge("ok","No recommendations");
        return;
      }
      el.innerHTML = '<ol style="margin:0; padding-left:18px;">'
        + recs.map(r => '<li style="margin:8px 0;">' + r + '</li>').join("")
        + '</ol>';
    }

    function setHeaderMeta(j) {
      document.getElementById("ts").textContent = new Date().toISOString();
      document.getElementById("nodeEnv").textContent = "NODE_ENV=" + (j?.runtime?.nodeEnv || "—");
    }

    async function load() {
      setOverall(false);
      const rawEl = document.getElementById("raw");
      rawEl.textContent = "Loading…";

      const r = await fetch('/api/diagnostics?token=' + encodeURIComponent(TOKEN), { cache: 'no-store' });
      const j = await r.json();
      lastJson = j;

      setHeaderMeta(j);
      setOverall(!!j.ok);
      setCoreRows(j);
      setEnvRows(j);
      setRecommendations(j);

      rawEl.textContent = JSON.stringify(j, null, 2);
    }

    document.getElementById("refreshBtn").addEventListener("click", load);
    document.getElementById("copyBtn").addEventListener("click", async () => {
      try {
        const text = lastJson ? JSON.stringify(lastJson, null, 2) : "";
        await navigator.clipboard.writeText(text);
      } catch {}
    });

    load();
  </script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (e) {
    // Do not leak internal error details here
    res.status(500).send("Server error");
  }
}
