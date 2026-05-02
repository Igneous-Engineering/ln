/**
 * auth.ts — OAuth 2.0 authorization code flow.
 *
 * Defaults to Google but can be pointed at any OAuth 2.0 / OpenID Connect
 * provider by setting OAUTH_AUTH_URL, OAUTH_TOKEN_URL, and OAUTH_USERINFO_URL.
 *
 * Endpoints:
 *   GET /_/auth/login    → redirect to OAuth provider
 *   GET /_/auth/callback → handle code exchange, create session
 *   GET /_/auth/logout   → destroy session, redirect to /
 */

import * as db from "./db";

const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID ?? "";
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET ?? "";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const REDIRECT_URI = `${BASE_URL}/_/auth/callback`;
const SITE_HOST = BASE_URL.replace(/^https?:\/\//, "");
const SESSION_TTL = parseInt(process.env.SESSION_TTL_SECONDS ?? "604800", 10);
const OAUTH_HD = process.env.OAUTH_HD ?? "";

const OAUTH_AUTH_URL = process.env.OAUTH_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = process.env.OAUTH_TOKEN_URL || "https://oauth2.googleapis.com/token";
const OAUTH_USERINFO_URL = process.env.OAUTH_USERINFO_URL || "https://www.googleapis.com/oauth2/v2/userinfo";
const OAUTH_SCOPE = process.env.OAUTH_SCOPE || "openid email profile";

// ---------------------------------------------------------------------------
// State tokens (CSRF protection) — stored in Valkey with short TTL
// ---------------------------------------------------------------------------

async function createState(): Promise<string> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const state = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await db.getClient().set(`oauth_state:${state}`, "1", "EX", "600"); // 10 min
  return state;
}

async function validateState(state: string): Promise<boolean> {
  const deleted = await db.getClient().del(`oauth_state:${state}`);
  return deleted > 0;
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export function getSessionToken(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const pairs = header.split(";").map((p) => p.trim().split("="));
  const found = pairs.find(([k]) => k === "ln_session");
  return found?.[1] ?? null;
}

const IS_SECURE = BASE_URL.startsWith("https://");
const COOKIE_FLAGS = `HttpOnly;${IS_SECURE ? " Secure;" : ""} SameSite=Lax; Path=/`;

export function sessionCookie(token: string, maxAge: number): string {
  return `ln_session=${token}; ${COOKIE_FLAGS}; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `ln_session=; ${COOKIE_FLAGS}; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// Get current user from request
// ---------------------------------------------------------------------------

export async function getUser(
  req: Request,
): Promise<db.SessionData | null> {
  const token = getSessionToken(req);
  if (!token) return null;
  return db.getSession(token);
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function handleLogin(_req: Request): Promise<Response> {
  const state = await createState();
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: OAUTH_SCOPE,
    state,
    access_type: "online",
    prompt: "select_account",
  });
  if (OAUTH_HD) params.set("hd", OAUTH_HD);
  return Response.redirect(`${OAUTH_AUTH_URL}?${params.toString()}`, 302);
}

export async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`OAuth error: ${error}`, { status: 400 });
  }

  if (!code || !state) {
    return new Response("Missing code or state parameter.", { status: 400 });
  }

  // Validate state
  const validState = await validateState(state);
  if (!validState) {
    return new Response("Invalid or expired state parameter. Please try again.", {
      status: 400,
    });
  }

  // Exchange code for tokens
  const tokenRes = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("[auth] Token exchange failed:", errBody);
    return new Response("Authentication failed. Please try again.", { status: 500 });
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    id_token?: string;
  };

  // Fetch user info
  const userRes = await fetch(OAUTH_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    return new Response("Failed to fetch user info.", { status: 500 });
  }

  const userInfo = (await userRes.json()) as {
    email: string;
    name: string;
    picture: string;
    hd?: string;
  };

  // Enforce domain restriction when OAUTH_HD is configured
  if (OAUTH_HD && !userInfo.email.endsWith(`@${OAUTH_HD}`)) {
    return new Response(
      errorPage(
        "Access Denied",
        `Only users with a @${OAUTH_HD} email can sign in.`,
      ),
      {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  // Create session
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000).toISOString();
  const sessionToken = await db.createSession({
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture ?? "",
    expires_at: expiresAt,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${BASE_URL}/_/`,
      "Set-Cookie": sessionCookie(sessionToken, SESSION_TTL),
    },
  });
}

export async function handleLogout(req: Request): Promise<Response> {
  const token = getSessionToken(req);
  if (token) {
    await db.deleteSession(token);
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${BASE_URL}/`,
      "Set-Cookie": clearSessionCookie(),
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — ${SITE_HOST}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Inter', system-ui, sans-serif;
      background: #0a0a0f; color: #e0e0e8;
    }
    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 3rem;
      max-width: 480px;
      text-align: center;
      backdrop-filter: blur(20px);
    }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; color: #ff6b6b; }
    p { line-height: 1.6; color: #a0a0b0; }
    a {
      display: inline-block; margin-top: 1.5rem;
      color: #7c5cfc; text-decoration: none;
    }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/">← Back to home</a>
  </div>
</body>
</html>`;
}
