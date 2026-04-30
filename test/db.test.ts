/**
 * test/db.test.ts — Unit tests for the Valkey data layer.
 *
 * Spins up an ephemeral Valkey container, runs tests, tears down.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { RedisClient } from "bun";
import { startValkey, stopValkey, flush } from "./helpers";

import * as db from "../db";

let client: RedisClient;

beforeAll(async () => {
  client = await startValkey();
  db.setClient(client);
});

afterAll(async () => {
  await stopValkey();
});

beforeEach(async () => {
  await flush();
});

// ===========================================================================
// System paths
// ===========================================================================

describe("isSystemPath", () => {
  test("root is a system path", () => {
    expect(db.isSystemPath("/")).toBe(true);
  });

  test("favicon is a system path", () => {
    expect(db.isSystemPath("/favicon.ico")).toBe(true);
  });

  test("meta prefix is a system path", () => {
    expect(db.isSystemPath("/_/api/links")).toBe(true);
    expect(db.isSystemPath("/_/")).toBe(true);
  });

  test(".well-known prefix is a system path", () => {
    expect(db.isSystemPath("/.well-known/acme-challenge/foo")).toBe(true);
  });

  test("normal paths are not system paths", () => {
    expect(db.isSystemPath("/yt")).toBe(false);
    expect(db.isSystemPath("/docs/api")).toBe(false);
  });
});

// ===========================================================================
// Links
// ===========================================================================

describe("createLink", () => {
  test("creates a link and retrieves it", async () => {
    const result = await db.createLink("/yt", "https://youtube.com", "user@example.com");
    expect(result.ok).toBe(true);

    const link = await db.getLink("/yt");
    expect(link).not.toBeNull();
    expect(link!.url).toBe("https://youtube.com");
    expect(link!.owner_email).toBe("user@example.com");
    expect(link!.created_at).toBeTruthy();
    expect(link!.updated_at).toBeTruthy();
  });

  test("rejects system paths", async () => {
    const result = await db.createLink("/", "https://example.com", "user@example.com");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("reserved by the system");
  });

  test("rejects duplicate paths", async () => {
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    const result = await db.createLink("/yt", "https://other.com", "other@example.com");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("already claimed");
  });

  test("rejects paths in reserved namespaces for non-owners", async () => {
    await db.reserveNamespace("tools", "admin@example.com", "Internal tools");
    const result = await db.createLink("/tools/jira", "https://jira.com", "user@example.com");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("reserved namespace");
  });

  test("allows namespace owner to create links in their namespace", async () => {
    await db.reserveNamespace("tools", "admin@example.com", "Internal tools");
    const result = await db.createLink("/tools/jira", "https://jira.com", "admin@example.com");
    expect(result.ok).toBe(true);
  });

  test("allows admins to create links in any namespace", async () => {
    await db.seedAdmins(["superadmin@example.com"]);
    await db.reserveNamespace("tools", "admin@example.com", "Internal tools");
    const result = await db.createLink("/tools/jira", "https://jira.com", "superadmin@example.com");
    expect(result.ok).toBe(true);
  });
});

describe("getLink", () => {
  test("returns null for non-existent links", async () => {
    const link = await db.getLink("/nonexistent");
    expect(link).toBeNull();
  });
});

describe("updateLink", () => {
  test("owner can update their link", async () => {
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    const result = await db.updateLink("/yt", "https://youtube.com/new", "user@example.com");
    expect(result.ok).toBe(true);

    const link = await db.getLink("/yt");
    expect(link!.url).toBe("https://youtube.com/new");
  });

  test("non-owner cannot update a link", async () => {
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    const result = await db.updateLink("/yt", "https://evil.com", "other@example.com");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("do not own");
  });

  test("admin can update any link", async () => {
    await db.seedAdmins(["admin@example.com"]);
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    const result = await db.updateLink("/yt", "https://youtube.com/admin", "admin@example.com");
    expect(result.ok).toBe(true);
  });

  test("returns error for non-existent link", async () => {
    const result = await db.updateLink("/nope", "https://example.com", "user@example.com");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });
});

describe("deleteLink", () => {
  test("owner can delete their link", async () => {
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    const result = await db.deleteLink("/yt", "user@example.com");
    expect(result.ok).toBe(true);

    const link = await db.getLink("/yt");
    expect(link).toBeNull();
  });

  test("non-owner cannot delete a link", async () => {
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    const result = await db.deleteLink("/yt", "other@example.com");
    expect(result.ok).toBe(false);
  });

  test("deleting removes from user's link set", async () => {
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    await db.deleteLink("/yt", "user@example.com");
    const links = await db.getUserLinks("user@example.com");
    expect(links).toHaveLength(0);
  });

  test("path becomes available again after deletion", async () => {
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    await db.deleteLink("/yt", "user@example.com");

    const available = await db.isPathAvailable("/yt");
    expect(available).toBe(true);

    // Re-claim should work
    const result = await db.createLink("/yt", "https://new.com", "other@example.com");
    expect(result.ok).toBe(true);
  });
});

describe("getUserLinks", () => {
  test("returns all links owned by a user", async () => {
    await db.createLink("/a", "https://a.com", "user@example.com");
    await db.createLink("/b", "https://b.com", "user@example.com");
    await db.createLink("/c", "https://c.com", "other@example.com");

    const links = await db.getUserLinks("user@example.com");
    expect(links).toHaveLength(2);
    const paths = links.map((l) => l.path).sort();
    expect(paths).toEqual(["/a", "/b"]);
  });

  test("returns empty array for user with no links", async () => {
    const links = await db.getUserLinks("nobody@example.com");
    expect(links).toHaveLength(0);
  });
});

describe("isPathAvailable", () => {
  test("unclaimed paths are available", async () => {
    expect(await db.isPathAvailable("/free")).toBe(true);
  });

  test("claimed paths are not available", async () => {
    await db.createLink("/taken", "https://example.com", "user@example.com");
    expect(await db.isPathAvailable("/taken")).toBe(false);
  });

  test("system paths are not available", async () => {
    expect(await db.isPathAvailable("/")).toBe(false);
    expect(await db.isPathAvailable("/favicon.ico")).toBe(false);
    expect(await db.isPathAvailable("/_/anything")).toBe(false);
  });
});

// ===========================================================================
// Visit tracking
// ===========================================================================

describe("visit tracking", () => {
  test("new links start with 0 visits", async () => {
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    const link = await db.getLink("/yt");
    expect(link!.visits).toBe(0);
  });

  test("incrementLinkVisits increments the counter", async () => {
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    await db.incrementLinkVisits("/yt");
    await db.incrementLinkVisits("/yt");
    await db.incrementLinkVisits("/yt");

    const link = await db.getLink("/yt");
    expect(link!.visits).toBe(3);
  });

  test("getLinkVisits returns current count", async () => {
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    expect(await db.getLinkVisits("/yt")).toBe(0);

    await db.incrementLinkVisits("/yt");
    expect(await db.getLinkVisits("/yt")).toBe(1);
  });

  test("visits are included in getUserLinks", async () => {
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    await db.incrementLinkVisits("/yt");
    await db.incrementLinkVisits("/yt");

    const links = await db.getUserLinks("user@example.com");
    expect(links[0].visits).toBe(2);
  });

  test("deleting a link clears visit counter", async () => {
    await db.createLink("/yt", "https://youtube.com", "user@example.com");
    await db.incrementLinkVisits("/yt");
    await db.incrementLinkVisits("/yt");

    await db.deleteLink("/yt", "user@example.com");
    expect(await db.getLinkVisits("/yt")).toBe(0);
  });
});

// ===========================================================================
// Namespaces
// ===========================================================================

describe("reserveNamespace", () => {
  test("reserves a namespace", async () => {
    const result = await db.reserveNamespace("tools", "admin@example.com", "Internal tools");
    expect(result.ok).toBe(true);

    const ns = await db.getNamespace("tools");
    expect(ns).not.toBeNull();
    expect(ns!.prefix).toBe("tools");
    expect(ns!.owner_email).toBe("admin@example.com");
    expect(ns!.description).toBe("Internal tools");
  });

  test("rejects duplicate namespace reservation", async () => {
    await db.reserveNamespace("tools", "admin@example.com", "First");
    const result = await db.reserveNamespace("tools", "other@example.com", "Second");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("already reserved");
  });
});

describe("releaseNamespace", () => {
  test("owner can release their namespace", async () => {
    await db.reserveNamespace("tools", "admin@example.com", "Tools");
    const result = await db.releaseNamespace("tools", "admin@example.com");
    expect(result.ok).toBe(true);

    const ns = await db.getNamespace("tools");
    expect(ns).toBeNull();
  });

  test("non-owner cannot release a namespace", async () => {
    await db.reserveNamespace("tools", "admin@example.com", "Tools");
    const result = await db.releaseNamespace("tools", "other@example.com");
    expect(result.ok).toBe(false);
  });

  test("released namespace disappears from listNamespaces", async () => {
    await db.reserveNamespace("tools", "admin@example.com", "Tools");
    await db.releaseNamespace("tools", "admin@example.com");
    const all = await db.listNamespaces();
    expect(all.find((n) => n.prefix === "tools")).toBeUndefined();
  });
});

describe("listNamespaces", () => {
  test("lists all reserved namespaces", async () => {
    await db.reserveNamespace("tools", "a@example.com", "Tools");
    await db.reserveNamespace("docs", "b@example.com", "Docs");
    const all = await db.listNamespaces();
    expect(all).toHaveLength(2);
    const prefixes = all.map((n) => n.prefix).sort();
    expect(prefixes).toEqual(["docs", "tools"]);
  });
});

describe("getNamespaceForPath", () => {
  test("returns matching namespace for a path", async () => {
    await db.reserveNamespace("tools", "admin@example.com", "Tools");
    const ns = await db.getNamespaceForPath("/tools/jira");
    expect(ns).not.toBeNull();
    expect(ns!.prefix).toBe("tools");
  });

  test("returns null when no namespace matches", async () => {
    const ns = await db.getNamespaceForPath("/yt");
    expect(ns).toBeNull();
  });

  test("returns longest matching prefix", async () => {
    await db.reserveNamespace("a", "x@example.com", "A");
    await db.reserveNamespace("a/b", "y@example.com", "A/B");
    const ns = await db.getNamespaceForPath("/a/b/c");
    expect(ns).not.toBeNull();
    expect(ns!.prefix).toBe("a/b");
  });
});

// ===========================================================================
// Sessions
// ===========================================================================

describe("sessions", () => {
  test("creates and retrieves a session", async () => {
    const futureDate = new Date(Date.now() + 3600_000).toISOString();
    const token = await db.createSession({
      email: "user@example.com",
      name: "Test User",
      picture: "https://example.com/pic.jpg",
      expires_at: futureDate,
    });

    expect(token).toBeTruthy();
    expect(token.length).toBe(64); // 32 bytes hex

    const session = await db.getSession(token);
    expect(session).not.toBeNull();
    expect(session!.email).toBe("user@example.com");
    expect(session!.name).toBe("Test User");
    expect(session!.picture).toBe("https://example.com/pic.jpg");
  });

  test("returns null for non-existent session", async () => {
    const session = await db.getSession("nonexistent-token");
    expect(session).toBeNull();
  });

  test("returns null and cleans up expired sessions", async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const token = await db.createSession({
      email: "user@example.com",
      name: "Expired",
      picture: "",
      expires_at: pastDate,
    });

    const session = await db.getSession(token);
    expect(session).toBeNull();
  });

  test("deleteSession removes the session", async () => {
    const futureDate = new Date(Date.now() + 3600_000).toISOString();
    const token = await db.createSession({
      email: "user@example.com",
      name: "Test",
      picture: "",
      expires_at: futureDate,
    });

    await db.deleteSession(token);
    const session = await db.getSession(token);
    expect(session).toBeNull();
  });
});

// ===========================================================================
// Admin
// ===========================================================================

describe("admin", () => {
  test("seedAdmins adds admin emails", async () => {
    await db.seedAdmins(["a@example.com", "b@example.com"]);
    expect(await db.isAdmin("a@example.com")).toBe(true);
    expect(await db.isAdmin("b@example.com")).toBe(true);
  });

  test("non-seeded email is not admin", async () => {
    expect(await db.isAdmin("nobody@example.com")).toBe(false);
  });

  test("seedAdmins is idempotent", async () => {
    await db.seedAdmins(["a@example.com"]);
    await db.seedAdmins(["a@example.com"]);
    expect(await db.isAdmin("a@example.com")).toBe(true);
  });
});

// ===========================================================================
// Bootstrap
// ===========================================================================

describe("bootstrap", () => {
  test("reserves the meta namespace on first run", async () => {
    // Simulate env
    process.env.ADMIN_EMAILS = "test-admin@example.com";
    await db.bootstrap();

    const ns = await db.getNamespace("_");
    expect(ns).not.toBeNull();
    expect(ns!.owner_email).toBe("system@example.com");

    expect(await db.isAdmin("test-admin@example.com")).toBe(true);
  });

  test("bootstrap is idempotent (does not fail on second run)", async () => {
    process.env.ADMIN_EMAILS = "test-admin@example.com";
    await db.bootstrap();
    await db.bootstrap(); // should not throw
    const ns = await db.getNamespace("_");
    expect(ns).not.toBeNull();
  });
});
