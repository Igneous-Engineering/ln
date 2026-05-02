/**
 * pages/dashboard.ts — Authenticated management dashboard.
 *
 * Single-page app (inline) for managing links and namespaces.
 * Communicates with /_/api/* via fetch from the browser.
 */

import type { SessionData } from "../db";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SITE_HOST = BASE_URL.replace(/^https?:\/\//, "");

export function renderDashboard(user: SessionData, isAdmin: boolean): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard — ${SITE_HOST}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg-primary: #06060b;
      --bg-card: rgba(255,255,255,0.03);
      --bg-card-hover: rgba(255,255,255,0.06);
      --bg-input: rgba(255,255,255,0.05);
      --border: rgba(255,255,255,0.07);
      --border-hover: rgba(255,255,255,0.14);
      --border-focus: rgba(124,92,252,0.5);
      --text-primary: #e8e8f0;
      --text-secondary: #8888a0;
      --text-muted: #55556a;
      --accent: #7c5cfc;
      --accent-glow: rgba(124,92,252,0.25);
      --accent-2: #5ce0d8;
      --accent-3: #fc5c8c;
      --success: #34d399;
      --error: #f87171;
      --mono: 'JetBrains Mono', monospace;
    }

    body {
      min-height: 100vh;
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
    }

    /* ---- Topbar ---- */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 2rem;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: rgba(6,6,11,0.9);
      backdrop-filter: blur(16px);
      z-index: 100;
    }

    .topbar-brand {
      font-family: var(--mono);
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--accent);
      text-decoration: none;
      letter-spacing: 0.05em;
    }

    .topbar-user {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .topbar-user img {
      width: 32px; height: 32px;
      border-radius: 50%;
      border: 2px solid var(--border);
    }

    .topbar-user span {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .topbar-user .badge {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      background: rgba(124,92,252,0.15);
      color: var(--accent);
      border: 1px solid rgba(124,92,252,0.25);
    }

    .btn-logout {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-decoration: none;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      transition: all 0.2s;
    }
    .btn-logout:hover {
      border-color: var(--error);
      color: var(--error);
    }

    /* ---- Layout ---- */
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 2rem;
    }

    /* ---- Section headers ---- */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .section-header h2 {
      font-size: 1.3rem;
      font-weight: 600;
    }

    /* ---- Cards ---- */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      transition: all 0.2s;
    }

    /* ---- Create form ---- */
    .create-form {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .input-group {
      flex: 1;
      min-width: 200px;
      position: relative;
    }

    .input-group label {
      display: block;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.4rem;
    }

    .input-prefix-wrap {
      display: flex;
      align-items: stretch;
    }

    .input-prefix {
      display: flex;
      align-items: center;
      padding: 0 0.6rem;
      border-radius: 10px 0 0 10px;
      border: 1px solid var(--border);
      border-right: none;
      background: rgba(255,255,255,0.08);
      color: var(--text-muted);
      font-family: var(--mono);
      font-size: 0.9rem;
      user-select: none;
    }

    input[type="text"], input[type="url"] {
      width: 100%;
      padding: 0.7rem 1rem;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--bg-input);
      color: var(--text-primary);
      font-family: var(--mono);
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .input-prefix-wrap input {
      border-radius: 0 10px 10px 0;
    }

    input:focus {
      border-color: var(--border-focus);
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.65rem 1.25rem;
      border-radius: 10px;
      border: none;
      font-family: 'Inter', sans-serif;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-create {
      background: var(--accent);
      color: white;
      align-self: flex-end;
      box-shadow: 0 2px 12px var(--accent-glow);
    }
    .btn-create:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 20px var(--accent-glow);
    }

    .btn-delete {
      background: rgba(248,113,113,0.1);
      color: var(--error);
      border: 1px solid rgba(248,113,113,0.2);
      padding: 0.4rem 0.75rem;
      font-size: 0.75rem;
    }
    .btn-delete:hover {
      background: rgba(248,113,113,0.2);
    }

    .btn-edit {
      background: rgba(124,92,252,0.1);
      color: var(--accent);
      border: 1px solid rgba(124,92,252,0.2);
      padding: 0.4rem 0.75rem;
      font-size: 0.75rem;
    }
    .btn-edit:hover {
      background: rgba(124,92,252,0.2);
    }

    /* ---- Link table ---- */
    .link-table {
      width: 100%;
      border-collapse: collapse;
    }

    .link-table th {
      text-align: left;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
    }

    .link-table td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border);
      font-size: 0.9rem;
      vertical-align: middle;
    }

    .link-table tr:last-child td {
      border-bottom: none;
    }

    .link-table tr:hover td {
      background: var(--bg-card-hover);
    }

    .link-path {
      font-family: var(--mono);
      font-weight: 500;
      color: var(--accent-2);
    }

    .link-path a {
      color: inherit;
      text-decoration: none;
    }
    .link-path a:hover {
      text-decoration: underline;
    }

    .link-url {
      color: var(--text-secondary);
      font-size: 0.85rem;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .link-url a {
      color: inherit;
      text-decoration: none;
    }
    .link-url a:hover {
      color: var(--text-primary);
    }

    .link-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }

    .link-visits {
      font-family: var(--mono);
      font-size: 0.8rem;
      color: var(--text-muted);
      text-align: right;
    }

    /* ---- Toast ---- */
    .toast-container {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .toast {
      padding: 0.75rem 1.25rem;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 500;
      animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
      backdrop-filter: blur(16px);
    }

    .toast-success {
      background: rgba(52,211,153,0.15);
      color: var(--success);
      border: 1px solid rgba(52,211,153,0.3);
    }

    .toast-error {
      background: rgba(248,113,113,0.15);
      color: var(--error);
      border: 1px solid rgba(248,113,113,0.3);
    }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
      to { opacity: 0; transform: translateY(10px); }
    }

    /* ---- Empty state ---- */
    .empty-state {
      text-align: center;
      padding: 3rem 2rem;
      color: var(--text-muted);
    }
    .empty-state .icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    .empty-state p {
      font-size: 0.9rem;
    }

    /* ---- Namespace list ---- */
    .ns-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
      gap: 1rem;
    }
    .ns-item:last-child { border-bottom: none; }

    .ns-prefix {
      font-family: var(--mono);
      font-weight: 500;
      color: var(--accent);
    }

    .ns-desc {
      color: var(--text-secondary);
      font-size: 0.85rem;
      flex: 1;
    }

    .ns-owner {
      color: var(--text-muted);
      font-size: 0.8rem;
    }

    /* ---- Edit inline ---- */
    .edit-input {
      width: 100%;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      border: 1px solid var(--border-focus);
      background: var(--bg-input);
      color: var(--text-primary);
      font-family: var(--mono);
      font-size: 0.85rem;
      outline: none;
    }

    .btn-save {
      background: rgba(52,211,153,0.15);
      color: var(--success);
      border: 1px solid rgba(52,211,153,0.3);
      padding: 0.4rem 0.75rem;
      font-size: 0.75rem;
    }
    .btn-save:hover { background: rgba(52,211,153,0.25); }

    .btn-cancel {
      background: var(--bg-card);
      color: var(--text-muted);
      border: 1px solid var(--border);
      padding: 0.4rem 0.75rem;
      font-size: 0.75rem;
    }
    .btn-cancel:hover { color: var(--text-secondary); }

    /* ---- Responsive ---- */
    @media (max-width: 640px) {
      .topbar { padding: 0.75rem 1rem; }
      .topbar-user span { display: none; }
      .container { padding: 1.5rem 1rem; }
      .create-form { flex-direction: column; }
      .btn-create { width: 100%; }
      .link-table { font-size: 0.8rem; }
      .link-table th, .link-table td { padding: 0.6rem 0.5rem; }
      .link-url { max-width: 150px; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <a href="/" class="topbar-brand">${escapeHtml(SITE_HOST)}</a>
    <div class="topbar-user">
      <img src="${escapeAttr(user.picture || "")}" alt="" referrerpolicy="no-referrer">
      <span>${escapeHtml(user.name)}</span>
      ${isAdmin ? '<span class="badge">admin</span>' : ""}
      <a href="/_/auth/logout" class="btn-logout">Sign out</a>
    </div>
  </div>

  <div class="container">
    <!-- Create Link -->
    <div class="section-header">
      <h2>Claim a link</h2>
    </div>
    <div class="card">
      <form class="create-form" id="create-form">
        <div class="input-group">
          <label for="input-path">Path</label>
          <div class="input-prefix-wrap">
            <span class="input-prefix">/</span>
            <input type="text" id="input-path" name="path" placeholder="yt" autocomplete="off" required>
          </div>
        </div>
        <div class="input-group" style="flex:2;">
          <label for="input-url">Destination URL</label>
          <input type="url" id="input-url" name="url" placeholder="https://youtube.com" required>
        </div>
        <button type="submit" class="btn-action btn-create">Claim</button>
      </form>
    </div>

    <!-- My Links -->
    <div class="section-header">
      <h2>My links</h2>
    </div>
    <div class="card" id="links-card">
      <div class="empty-state" id="links-empty">
        <div class="icon">🔗</div>
        <p>You haven't claimed any links yet.</p>
      </div>
      <table class="link-table" id="links-table" style="display:none;">
        <thead>
          <tr>
            <th>Path</th>
            <th>Destination</th>
            <th style="text-align:right;">Visits</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody id="links-tbody"></tbody>
      </table>
    </div>

    ${isAdmin ? `
    <!-- Namespaces (Admin) -->
    <div class="section-header">
      <h2>Namespaces</h2>
    </div>
    <div class="card">
      <form class="create-form" id="ns-form" style="margin-bottom:1.5rem;">
        <div class="input-group">
          <label for="input-ns-prefix">Prefix</label>
          <input type="text" id="input-ns-prefix" name="prefix" placeholder="tools" autocomplete="off" required>
        </div>
        <div class="input-group" style="flex:2;">
          <label for="input-ns-desc">Description</label>
          <input type="text" id="input-ns-desc" name="description" placeholder="Internal tools namespace">
        </div>
        <button type="submit" class="btn-action btn-create">Reserve</button>
      </form>
      <div id="ns-list"></div>
    </div>
    ` : ""}
  </div>

  <div class="toast-container" id="toast-container"></div>

  <script>
    const BASE = '';

    // ---- Toast ----
    function toast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      const el = document.createElement('div');
      el.className = 'toast toast-' + type;
      el.textContent = message;
      container.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }

    // ---- API helpers ----
    async function api(path, opts = {}) {
      const res = await fetch(BASE + path, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...opts.headers },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    // ---- Load links ----
    async function loadLinks() {
      try {
        const { links } = await api('/_/api/links');
        const tbody = document.getElementById('links-tbody');
        const table = document.getElementById('links-table');
        const empty = document.getElementById('links-empty');

        if (!links.length) {
          table.style.display = 'none';
          empty.style.display = 'block';
          return;
        }

        table.style.display = 'table';
        empty.style.display = 'none';
        tbody.innerHTML = '';

        links.sort((a, b) => a.path.localeCompare(b.path));

        for (const link of links) {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td class="link-path"><a href="\${link.path}" target="_blank">\${esc(link.path)}</a></td>
            <td class="link-url"><a href="\${esc(link.url)}" target="_blank" title="\${esc(link.url)}">\${esc(link.url)}</a></td>
            <td class="link-visits">\${link.visits.toLocaleString()}</td>
            <td class="link-actions">
              <button class="btn-action btn-edit" onclick="editLink(this, '\${escAttr(link.path)}', '\${escAttr(link.url)}')">Edit</button>
              <button class="btn-action btn-delete" onclick="deleteLink('\${escAttr(link.path)}')">Delete</button>
            </td>
          \`;
          tbody.appendChild(tr);
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    // ---- Create link ----
    document.getElementById('create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawPath = document.getElementById('input-path').value.trim();
      const url = document.getElementById('input-url').value.trim();
      // Strip leading slash if user typed one — the API auto-prepends it
      const path = rawPath.startsWith('/') ? rawPath : '/' + rawPath;

      try {
        await api('/_/api/links', {
          method: 'POST',
          body: JSON.stringify({ path, url }),
        });
        toast('Link claimed: ' + path);
        document.getElementById('input-path').value = '';
        document.getElementById('input-url').value = '';
        loadLinks();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // ---- Edit link (inline) ----
    function editLink(btn, path, currentUrl) {
      const tr = btn.closest('tr');
      const urlTd = tr.querySelector('.link-url');
      const actionsTd = tr.querySelector('.link-actions');

      urlTd.innerHTML = '<input class="edit-input" value="' + escAttr(currentUrl) + '" id="edit-url-input">';
      actionsTd.innerHTML = \`
        <button class="btn-action btn-save" onclick="saveEdit('\${escAttr(path)}')">Save</button>
        <button class="btn-action btn-cancel" onclick="loadLinks()">Cancel</button>
      \`;

      tr.querySelector('.edit-input').focus();
      tr.querySelector('.edit-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveEdit(path); }
        if (e.key === 'Escape') loadLinks();
      });
    }

    async function saveEdit(path) {
      const input = document.getElementById('edit-url-input');
      if (!input) return;
      const url = input.value.trim();
      if (!url) { toast('URL is required', 'error'); return; }

      try {
        const encodedPath = encodeURIComponent(path.slice(1));
        await api('/_/api/links/' + encodedPath, {
          method: 'PUT',
          body: JSON.stringify({ url }),
        });
        toast('Link updated');
        loadLinks();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    // ---- Delete link ----
    async function deleteLink(path) {
      if (!confirm('Delete ' + path + '?')) return;
      try {
        const encodedPath = encodeURIComponent(path.slice(1));
        await api('/_/api/links/' + encodedPath, { method: 'DELETE' });
        toast('Link deleted');
        loadLinks();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    ${isAdmin ? `
    // ---- Load namespaces ----
    async function loadNamespaces() {
      try {
        const { namespaces } = await api('/_/api/namespaces');
        const list = document.getElementById('ns-list');
        if (!namespaces.length) {
          list.innerHTML = '<div class="empty-state"><p>No namespaces reserved yet.</p></div>';
          return;
        }
        list.innerHTML = '';
        for (const ns of namespaces) {
          const el = document.createElement('div');
          el.className = 'ns-item';
          el.innerHTML = \`
            <span class="ns-prefix">/\${esc(ns.prefix)}/</span>
            <span class="ns-desc">\${esc(ns.description || '—')}</span>
            <span class="ns-owner">\${esc(ns.owner_email)}</span>
            \${ns.prefix === '_' ? '' : '<button class="btn-action btn-delete" onclick="deleteNamespace(\\'' + escAttr(ns.prefix) + '\\')">Release</button>'}
          \`;
          list.appendChild(el);
        }
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    // ---- Create namespace ----
    document.getElementById('ns-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const prefix = document.getElementById('input-ns-prefix').value.trim();
      const description = document.getElementById('input-ns-desc').value.trim();

      try {
        await api('/_/api/namespaces', {
          method: 'POST',
          body: JSON.stringify({ prefix, description }),
        });
        toast('Namespace reserved: /' + prefix + '/');
        document.getElementById('input-ns-prefix').value = '';
        document.getElementById('input-ns-desc').value = '';
        loadNamespaces();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // ---- Delete namespace ----
    async function deleteNamespace(prefix) {
      if (!confirm('Release namespace /' + prefix + '/?')) return;
      try {
        await api('/_/api/namespaces/' + encodeURIComponent(prefix), { method: 'DELETE' });
        toast('Namespace released');
        loadNamespaces();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    loadNamespaces();
    ` : ""}

    // ---- Escape helpers ----
    function esc(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
    function escAttr(s) {
      var bs = String.fromCharCode(92);
      var qt = String.fromCharCode(38) + 'quot;';
      return s.replaceAll(bs, bs+bs).replaceAll("'", bs+"'").replaceAll('"', qt);
    }

    // ---- Init ----
    loadLinks();

    // Pre-fill from 404 "Claim this path" link
    if (location.hash.startsWith('#claim=')) {
      const claimPath = decodeURIComponent(location.hash.slice(7));
      if (claimPath) {
        // Strip leading slash — the input prefix already shows it
        document.getElementById('input-path').value = claimPath.startsWith('/') ? claimPath.slice(1) : claimPath;
        document.getElementById('input-url').focus();
        history.replaceState(null, '', location.pathname);
      }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
