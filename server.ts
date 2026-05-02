/**
 * server.ts — Main entry point for the ln URL shortener
 *
 * Routing:
 *   GET /                 → Welcome page (public)
 *   GET /favicon.ico      → Favicon
 *   GET /_/auth/login     → OAuth redirect
 *   GET /_/auth/callback  → OAuth callback
 *   GET /_/auth/logout    → Destroy session
 *   GET /_/               → Dashboard (authenticated)
 *   *   /_/api/*          → REST API (authenticated)
 *   GET /<anything>       → Link resolution → 302 redirect (public)
 */

import * as db from "./db";
import * as auth from "./auth";
import { handleApi } from "./api";
import { renderWelcomePage } from "./pages/welcome";
import { renderDashboard } from "./pages/dashboard";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SITE_HOST = BASE_URL.replace(/^https?:\/\//, "");
const IS_PROD = process.env.NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Favicon (inline SVG → ICO-ish PNG)
// ---------------------------------------------------------------------------

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#7c5cfc"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="monospace" font-weight="bold" font-size="32" fill="white">ln</text>
</svg>`;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

await db.bootstrap();

const server = Bun.serve({
  port: parseInt(process.env.PORT ?? "3000", 10),

  // Static routes
  routes: {
    "/favicon.ico": () =>
      new Response(FAVICON_SVG, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400",
        },
      }),
  },

  // Dynamic fallback — handles auth, API, dashboard, and redirects
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // ---- Valkey health gate ----
    if (!db.isHealthy()) {
      if (path.startsWith("/_/api/")) {
        return Response.json(
          { error: "Service temporarily unavailable." },
          { status: 503, headers: { "Retry-After": "30" } },
        );
      }
      return renderDownPage();
    }

    // ---- Landing page ----
    if (path === "/") {
      const user = await auth.getUser(req);
      if (user) {
        return Response.redirect(`${BASE_URL}/_/`, 302);
      }
      return renderWelcomePage();
    }

    // ---- Auth routes ----
    if (path === "/_/auth/login") {
      return auth.handleLogin(req);
    }
    if (path === "/_/auth/callback") {
      return auth.handleCallback(req);
    }
    if (path === "/_/auth/logout") {
      return auth.handleLogout(req);
    }

    // ---- Dashboard ----
    if (path === "/_/" || path === "/_") {
      const user = await auth.getUser(req);
      if (!user) {
        return Response.redirect(`${BASE_URL}/_/auth/login`, 302);
      }
      const isAdmin = await db.isAdmin(user.email);
      return renderDashboard(user, isAdmin);
    }

    // ---- API routes ----
    if (path.startsWith("/_/api/")) {
      return handleApi(req);
    }

    // ---- Block .well-known ----
    if (path.startsWith("/.well-known/")) {
      return new Response("Not Found", { status: 404 });
    }

    // ---- Link resolution (public, unauthenticated) ----
    const link = await db.getLink(path);
    if (link) {
      // Fire-and-forget — don't delay the redirect
      db.incrementLinkVisits(path);
      return Response.redirect(link.url, 302);
    }

    // ---- 404 ----
    const user = await auth.getUser(req);
    const claimable = user ? await db.isPathAvailable(path) : false;
    return render404(path, claimable);
  },

  // Production error handler — hide stack traces from clients
  error(error) {
    console.error("[server] Unhandled error:", error);
    if (IS_PROD) {
      return renderDownPage();
    }
    // In dev, return undefined to let Bun show its detailed error page
    return undefined;
  },
});

console.log(`✨ ln running`);
console.log(`   listening on ${server.hostname}:${server.port}`);
console.log(`   public url  ${BASE_URL}`);

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown() {
  console.log("\n🛑 Shutting down...");
  server.stop();
  db.getClient().close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ---------------------------------------------------------------------------
// 503 "down" page — used for unhandled errors (prod) and Valkey outages
// ---------------------------------------------------------------------------

function renderDownPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Service Unavailable — ${SITE_HOST}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Inter', system-ui, sans-serif;
      background: #06060b; color: #e8e8f0;
    }
    .card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px;
      padding: 3rem;
      max-width: 480px;
      text-align: center;
      backdrop-filter: blur(20px);
    }
    .code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 4rem;
      font-weight: 700;
      background: linear-gradient(135deg, #fc5c5c, #fc8c5c);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1rem;
    }
    h1 { font-size: 1.3rem; margin-bottom: 0.75rem; }
    p { color: #8888a0; font-size: 0.95rem; line-height: 1.6; }
    .pulse {
      display: inline-block;
      width: 10px; height: 10px;
      background: #fc5c5c;
      border-radius: 50%;
      margin-right: 0.5rem;
      animation: pulse 2s ease-in-out infinite;
      vertical-align: middle;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="code">503</div>
    <h1>Service Unavailable</h1>
    <p><span class="pulse"></span>We're working on it. Please try again shortly.</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "30",
    },
  });
}

// ---------------------------------------------------------------------------
// 404 page
// ---------------------------------------------------------------------------

function render404(path: string, claimable: boolean): Response {
  const claimLink = claimable
    ? `<a href="/_/#claim=${encodeURIComponent(path)}" class="btn-claim">Claim this path →</a>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 — ${SITE_HOST}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Inter', system-ui, sans-serif;
      background: #06060b; color: #e8e8f0;
    }
    .card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px;
      padding: 3rem;
      max-width: 480px;
      text-align: center;
      backdrop-filter: blur(20px);
    }
    .code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 4rem;
      font-weight: 700;
      background: linear-gradient(135deg, #7c5cfc, #fc5c8c);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1rem;
    }
    h1 { font-size: 1.3rem; margin-bottom: 0.75rem; }
    p { color: #8888a0; font-size: 0.95rem; line-height: 1.6; margin-bottom: 0.5rem; }
    .path {
      font-family: 'JetBrains Mono', monospace;
      color: #5ce0d8;
      background: rgba(92,224,216,0.08);
      padding: 0.1rem 0.5rem;
      border-radius: 6px;
      font-size: 0.9rem;
    }
    .links {
      margin-top: 2rem;
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }
    a {
      color: #7c5cfc;
      text-decoration: none;
      font-weight: 500;
      font-size: 0.9rem;
      transition: color 0.2s;
    }
    a:hover { color: #a08dff; }
    .btn-claim {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.65rem 1.5rem;
      border-radius: 10px;
      background: #7c5cfc;
      color: white;
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
      box-shadow: 0 2px 12px rgba(124,92,252,0.25);
      transition: all 0.2s;
    }
    .btn-claim:hover {
      color: white;
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(124,92,252,0.35);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="code">404</div>
    <h1>Link not found</h1>
    <p>The path <span class="path">${escapeHtml(path)}</span> hasn't been claimed yet.</p>
    ${claimLink}
    <div class="links">
      <a href="/">← Home</a>
      <a href="/_/">Dashboard →</a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
