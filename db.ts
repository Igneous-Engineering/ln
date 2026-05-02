/**
 * db.ts — Valkey data layer using Bun's built-in Redis client.
 *
 * Key schema:
 *   link:<path>         Hash  {url, owner_email, created_at, updated_at}
 *   ns:<prefix>         Hash  {owner_email, created_at, description}
 *   session:<token>     Hash  {email, name, picture, expires_at}
 *   user:<email>:links  Set   set of link paths owned by this user
 *   admin:emails        Set   admin email addresses
 *   ns:index            Set   all reserved namespace prefixes
 */

import { RedisClient } from "bun";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkRecord {
  url: string;
  owner_email: string;
  created_at: string;
  updated_at: string;
  visits: number;
}

export interface NamespaceRecord {
  prefix: string;
  owner_email: string;
  created_at: string;
  description: string;
}

export interface SessionData {
  email: string;
  name: string;
  picture: string;
  expires_at: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// Client — injectable for testing
// ---------------------------------------------------------------------------

const VALKEY_URL = process.env.VALKEY_URL ?? "redis://localhost:6379";
console.log(`[db] Connecting to Valkey at ${VALKEY_URL}`);
let redis: RedisClient = new RedisClient(VALKEY_URL);

/** Replace the active client (used by tests to point at an ephemeral instance). */
export function setClient(client: RedisClient): void {
  redis = client;
}

/** Expose for health-checks and tests. */
export function getClient(): RedisClient {
  return redis;
}

// ---------------------------------------------------------------------------
// Reserved / system paths
// ---------------------------------------------------------------------------

const SYSTEM_PATHS = ["/", "/favicon.ico"];
const SYSTEM_PREFIXES = ["/_/", "/.well-known/"];

export function isSystemPath(path: string): boolean {
  if (SYSTEM_PATHS.includes(path)) return true;
  for (const prefix of SYSTEM_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export async function getLink(path: string): Promise<LinkRecord | null> {
  const fields = await redis.hmget(`link:${path}`, [
    "url",
    "owner_email",
    "created_at",
    "updated_at",
  ]);
  if (!fields || !fields[0]) return null;
  const visits = await getLinkVisits(path);
  return {
    url: fields[0]!,
    owner_email: fields[1]!,
    created_at: fields[2]!,
    updated_at: fields[3]!,
    visits,
  };
}

export async function createLink(
  path: string,
  url: string,
  ownerEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  // Check system paths
  if (isSystemPath(path)) {
    return { ok: false, error: "This path is reserved by the system." };
  }

  // Check if already claimed
  const existing = await redis.exists(`link:${path}`);
  if (existing) {
    return { ok: false, error: "This path is already claimed." };
  }

  // Check namespace reservations
  const ns = await getNamespaceForPath(path);
  if (ns && ns.owner_email !== ownerEmail) {
    const isAdm = await isAdmin(ownerEmail);
    if (!isAdm) {
      return {
        ok: false,
        error: `This path is within the reserved namespace '${ns.prefix}'. Contact ${ns.owner_email} to request access.`,
      };
    }
  }

  const now = new Date().toISOString();
  await redis.hset(`link:${path}`, {
    url,
    owner_email: ownerEmail,
    created_at: now,
    updated_at: now,
  });
  await redis.sadd(`user:${ownerEmail}:links`, path);
  return { ok: true };
}

export async function updateLink(
  path: string,
  url: string,
  ownerEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  const link = await getLink(path);
  if (!link) return { ok: false, error: "Link not found." };
  if (link.owner_email !== ownerEmail) {
    const isAdm = await isAdmin(ownerEmail);
    if (!isAdm) {
      return { ok: false, error: "You do not own this link." };
    }
  }
  const now = new Date().toISOString();
  await redis.hset(`link:${path}`, {
    url,
    updated_at: now,
  });
  return { ok: true };
}

export async function deleteLink(
  path: string,
  ownerEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  const link = await getLink(path);
  if (!link) return { ok: false, error: "Link not found." };
  if (link.owner_email !== ownerEmail) {
    const isAdm = await isAdmin(ownerEmail);
    if (!isAdm) {
      return { ok: false, error: "You do not own this link." };
    }
  }
  await redis.del(`link:${path}`);
  await redis.del(`link:${path}:visits`);
  await redis.srem(`user:${link.owner_email}:links`, path);
  return { ok: true };
}

/** Atomically increment the visit counter for a link. */
export async function incrementLinkVisits(path: string): Promise<void> {
  await redis.incr(`link:${path}:visits`);
}

/** Get the current visit count for a link. */
export async function getLinkVisits(path: string): Promise<number> {
  const val = await redis.get(`link:${path}:visits`);
  return val ? parseInt(val, 10) : 0;
}

export async function getUserLinks(email: string): Promise<(LinkRecord & { path: string })[]> {
  const paths = (await redis.smembers(`user:${email}:links`)) as string[];
  const results: (LinkRecord & { path: string })[] = [];
  for (const p of paths) {
    const link = await getLink(p);
    if (link) results.push({ ...link, path: p });
  }
  return results;
}

export async function isPathAvailable(path: string): Promise<boolean> {
  if (isSystemPath(path)) return false;
  const exists = await redis.exists(`link:${path}`);
  return !exists;
}

// ---------------------------------------------------------------------------
// Namespaces
// ---------------------------------------------------------------------------

export async function getNamespace(prefix: string): Promise<NamespaceRecord | null> {
  const fields = await redis.hmget(`ns:${prefix}`, [
    "owner_email",
    "created_at",
    "description",
  ]);
  if (!fields || !fields[0]) return null;
  return {
    prefix,
    owner_email: fields[0]!,
    created_at: fields[1]!,
    description: fields[2]!,
  };
}

export async function reserveNamespace(
  prefix: string,
  ownerEmail: string,
  description: string,
): Promise<{ ok: boolean; error?: string }> {
  // Validate not already reserved
  const existing = await getNamespace(prefix);
  if (existing) {
    return { ok: false, error: `Namespace '${prefix}' is already reserved by ${existing.owner_email}.` };
  }

  const now = new Date().toISOString();
  await redis.hset(`ns:${prefix}`, {
    owner_email: ownerEmail,
    created_at: now,
    description,
  });
  await redis.sadd("ns:index", prefix);
  return { ok: true };
}

export async function releaseNamespace(
  prefix: string,
  ownerEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  const ns = await getNamespace(prefix);
  if (!ns) return { ok: false, error: "Namespace not found." };
  if (ns.owner_email !== ownerEmail) {
    const isAdm = await isAdmin(ownerEmail);
    if (!isAdm) {
      return { ok: false, error: "You do not own this namespace." };
    }
  }
  await redis.del(`ns:${prefix}`);
  await redis.srem("ns:index", prefix);
  return { ok: true };
}

export async function listNamespaces(): Promise<NamespaceRecord[]> {
  const prefixes = (await redis.smembers("ns:index")) as string[];
  const results: NamespaceRecord[] = [];
  for (const p of prefixes) {
    const ns = await getNamespace(p);
    if (ns) results.push(ns);
  }
  return results;
}

/**
 * Find the namespace that owns a given path. Uses longest-prefix match.
 * e.g. path="/foo/bar/baz" checks "/foo/bar/" then "/foo/" then matches.
 */
export async function getNamespaceForPath(path: string): Promise<NamespaceRecord | null> {
  // Gather all reserved prefixes
  const prefixes = (await redis.smembers("ns:index")) as string[];
  if (!prefixes.length) return null;

  // Find all matching prefixes, pick the longest
  let best: NamespaceRecord | null = null;
  let bestLen = 0;
  for (const p of prefixes) {
    const nsPath = `/${p}/`;
    if (path.startsWith(nsPath) || path === `/${p}`) {
      if (nsPath.length > bestLen) {
        const ns = await getNamespace(p);
        if (ns) {
          best = ns;
          bestLen = nsPath.length;
        }
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const SESSION_TTL = parseInt(process.env.SESSION_TTL_SECONDS ?? "604800", 10);

export async function createSession(data: SessionData): Promise<string> {
  const token = generateToken();
  const key = `session:${token}`;
  await redis.hset(key, {
    email: data.email,
    name: data.name,
    picture: data.picture,
    expires_at: data.expires_at,
  });
  await redis.expire(key, SESSION_TTL);
  return token;
}

export async function getSession(token: string): Promise<SessionData | null> {
  const fields = await redis.hmget(`session:${token}`, [
    "email",
    "name",
    "picture",
    "expires_at",
  ]);
  if (!fields || !fields[0]) return null;
  const data: SessionData = {
    email: fields[0]!,
    name: fields[1]!,
    picture: fields[2]!,
    expires_at: fields[3]!,
  };
  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    await redis.del(`session:${token}`);
    return null;
  }
  return data;
}

export async function deleteSession(token: string): Promise<void> {
  await redis.del(`session:${token}`);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function isAdmin(email: string): Promise<boolean> {
  return redis.sismember("admin:emails", email);
}

export async function seedAdmins(emails: string[]): Promise<void> {
  if (!emails.length) return;
  await redis.sadd("admin:emails", ...emails);
}

// ---------------------------------------------------------------------------
// Startup bootstrap
// ---------------------------------------------------------------------------

export async function bootstrap(): Promise<void> {
  // Seed admin emails from environment
  const adminEnv = process.env.ADMIN_EMAILS ?? "";
  const adminEmails = adminEnv
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (adminEmails.length) {
    await seedAdmins(adminEmails);
    console.log(`[db] Seeded ${adminEmails.length} admin(s)`);
  }

  // Reserve the meta namespace
  const metaNs = await getNamespace("_");
  if (!metaNs) {
    await reserveNamespace("_", "system@example.com", "System API namespace");
    console.log("[db] Reserved '_' (meta) namespace");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
