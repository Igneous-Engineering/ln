/**
 * api.ts — REST API handlers under /_/api/.
 *
 * All routes require authentication via session cookie.
 * Namespace management routes additionally require admin privileges.
 */

import * as db from "./db";
import { getUser } from "./auth";

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export async function handleApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Authenticate
  const user = await getUser(req);
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  // ---- User info ----
  if (path === "/_/api/me" && method === "GET") {
    const admin = await db.isAdmin(user.email);
    return Response.json({
      email: user.email,
      name: user.name,
      picture: user.picture,
      is_admin: admin,
    });
  }

  // ---- Links ----
  if (path === "/_/api/links" && method === "GET") {
    return handleListLinks(user);
  }
  if (path === "/_/api/links" && method === "POST") {
    return handleCreateLink(req, user);
  }

  // Single link operations — /_/api/links/<encoded-path>
  const linkMatch = path.match(/^\/_\/api\/links\/(.+)$/);
  if (linkMatch) {
    const linkPath = "/" + decodeURIComponent(linkMatch[1]);
    if (method === "GET") return handleGetLink(linkPath);
    if (method === "PUT") return handleUpdateLink(req, linkPath, user);
    if (method === "DELETE") return handleDeleteLink(linkPath, user);
  }

  // ---- Namespaces ----
  if (path === "/_/api/namespaces" && method === "GET") {
    return handleListNamespaces();
  }
  if (path === "/_/api/namespaces" && method === "POST") {
    return handleCreateNamespace(req, user);
  }

  const nsMatch = path.match(/^\/_\/api\/namespaces\/(.+)$/);
  if (nsMatch) {
    const nsPrefix = decodeURIComponent(nsMatch[1]);
    if (method === "DELETE") return handleDeleteNamespace(nsPrefix, user);
  }

  // ---- Check availability ----
  if (path === "/_/api/check" && method === "GET") {
    const checkPath = url.searchParams.get("path");
    if (!checkPath) {
      return Response.json({ error: "Missing 'path' query parameter." }, { status: 400 });
    }
    const available = await db.isPathAvailable(checkPath);
    return Response.json({ path: checkPath, available });
  }

  return Response.json({ error: "Not found." }, { status: 404 });
}

// ---------------------------------------------------------------------------
// Link handlers
// ---------------------------------------------------------------------------

async function handleListLinks(user: db.SessionData): Promise<Response> {
  const links = await db.getUserLinks(user.email);
  return Response.json({ links });
}

async function handleCreateLink(
  req: Request,
  user: db.SessionData,
): Promise<Response> {
  let body: { path?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { url } = body;
  let { path } = body;

  if (!path || !url) {
    return Response.json(
      { error: "Both 'path' and 'url' are required." },
      { status: 400 },
    );
  }

  // Auto-prepend leading slash if the user omitted it
  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  // Validate path format
  if (!/^\/[a-zA-Z0-9_\-\/]+$/.test(path)) {
    return Response.json(
      { error: "Path may only contain letters, numbers, hyphens, underscores, and slashes." },
      { status: 400 },
    );
  }

  // Validate URL
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return Response.json(
        { error: "URL must use http or https protocol." },
        { status: 400 },
      );
    }
  } catch {
    return Response.json({ error: "Invalid URL." }, { status: 400 });
  }

  const result = await db.createLink(path, url, user.email);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 409 });
  }

  return Response.json({ ok: true, path, url }, { status: 201 });
}

async function handleGetLink(linkPath: string): Promise<Response> {
  const link = await db.getLink(linkPath);
  if (!link) {
    return Response.json({ error: "Link not found." }, { status: 404 });
  }
  return Response.json({ path: linkPath, ...link });
}

async function handleUpdateLink(
  req: Request,
  linkPath: string,
  user: db.SessionData,
): Promise<Response> {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.url) {
    return Response.json({ error: "'url' is required." }, { status: 400 });
  }

  // Validate URL
  try {
    const parsed = new URL(body.url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return Response.json(
        { error: "URL must use http or https protocol." },
        { status: 400 },
      );
    }
  } catch {
    return Response.json({ error: "Invalid URL." }, { status: 400 });
  }

  const result = await db.updateLink(linkPath, body.url, user.email);
  if (!result.ok) {
    return Response.json(
      { error: result.error },
      { status: result.error === "Link not found." ? 404 : 403 },
    );
  }

  return Response.json({ ok: true, path: linkPath, url: body.url });
}

async function handleDeleteLink(
  linkPath: string,
  user: db.SessionData,
): Promise<Response> {
  const result = await db.deleteLink(linkPath, user.email);
  if (!result.ok) {
    return Response.json(
      { error: result.error },
      { status: result.error === "Link not found." ? 404 : 403 },
    );
  }
  return Response.json({ ok: true, path: linkPath });
}

// ---------------------------------------------------------------------------
// Namespace handlers
// ---------------------------------------------------------------------------

async function handleListNamespaces(): Promise<Response> {
  const namespaces = await db.listNamespaces();
  return Response.json({ namespaces });
}

async function handleCreateNamespace(
  req: Request,
  user: db.SessionData,
): Promise<Response> {
  // Admin only
  const admin = await db.isAdmin(user.email);
  if (!admin) {
    return Response.json(
      { error: "Only admins can reserve namespaces." },
      { status: 403 },
    );
  }

  let body: { prefix?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.prefix) {
    return Response.json({ error: "'prefix' is required." }, { status: 400 });
  }

  // Validate prefix format
  if (!/^[a-zA-Z0-9_\-]+$/.test(body.prefix)) {
    return Response.json(
      { error: "Prefix may only contain letters, numbers, hyphens, and underscores." },
      { status: 400 },
    );
  }

  const result = await db.reserveNamespace(
    body.prefix,
    user.email,
    body.description ?? "",
  );
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 409 });
  }

  return Response.json(
    { ok: true, prefix: body.prefix },
    { status: 201 },
  );
}

async function handleDeleteNamespace(
  nsPrefix: string,
  user: db.SessionData,
): Promise<Response> {
  // Admin only
  const admin = await db.isAdmin(user.email);
  if (!admin) {
    return Response.json(
      { error: "Only admins can release namespaces." },
      { status: 403 },
    );
  }

  const result = await db.releaseNamespace(nsPrefix, user.email);
  if (!result.ok) {
    return Response.json(
      { error: result.error },
      { status: result.error === "Namespace not found." ? 404 : 403 },
    );
  }

  return Response.json({ ok: true, prefix: nsPrefix });
}
