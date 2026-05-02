/**
 * test/helpers.ts — Test infrastructure for ephemeral Valkey container.
 *
 * Spins up a Valkey container on a random port before tests, tears it
 * down afterwards. Provides a flush helper for per-test isolation.
 */

import { RedisClient } from "bun";
import { $ } from "bun";

const CONTAINER_NAME = `ln-test-valkey-${Date.now()}`;
const IMAGE = "docker.io/valkey/valkey:8-alpine";
let port: number;
let client: RedisClient;

/**
 * Start an ephemeral Valkey container and return a connected RedisClient.
 * The container is removed on teardown.
 */
export async function startValkey(): Promise<RedisClient> {
  // -P publishes all exposed ports to random host ports
  const result =
    await $`podman run -d --rm --name ${CONTAINER_NAME} -P ${IMAGE}`.text();
  const containerId = result.trim();

  // Discover the mapped host port
  const portOutput =
    await $`podman port ${CONTAINER_NAME} 6379/tcp`.text();
  // Output like "0.0.0.0:43210" or "[::]:43210"
  const match = portOutput.trim().match(/:(\d+)$/m);
  if (!match) {
    throw new Error(`Could not determine mapped port from: ${portOutput}`);
  }
  port = parseInt(match[1], 10);

  // Wait for Valkey to be ready (retry ping for up to 5s)
  client = new RedisClient(`redis://localhost:${port}`);
  for (let i = 0; i < 50; i++) {
    try {
      const pong = await client.send("PING", []);
      if (pong === "PONG") break;
    } catch {
      await Bun.sleep(100);
    }
  }

  return client;
}

/** Flush all keys — call between tests for isolation. */
export async function flush(): Promise<void> {
  await client.send("FLUSHDB", []);
}

/** Stop and remove the ephemeral Valkey container. */
export async function stopValkey(): Promise<void> {
  try {
    // Detach event handlers before closing so the db module's onclose
    // doesn't fire for an intentional test teardown.
    client.onclose = () => {};
    client.close();
  } catch { /* ignore */ }
  try {
    await $`podman stop ${CONTAINER_NAME}`.quiet();
  } catch { /* container may already be gone (--rm) */ }
}
