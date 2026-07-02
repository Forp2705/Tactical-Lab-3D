const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "0.0.0.0",
]);

export function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname);
}

export function resolveUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function createGuardedFetch(originalFetch: typeof fetch): typeof fetch {
  const guarded = (input: string | URL | Request, init?: RequestInit) => {
    const url = resolveUrl(input);
    let hostname = "";
    try {
      hostname = new URL(url).hostname;
    } catch {
      // Relative URLs (no host) are treated as local.
      hostname = "";
    }
    if (hostname && !isLocalHost(hostname)) {
      throw new Error(
        `[networkGuard] Blocked network call to ${hostname}. Tests run offline by default. Set ALLOW_NETWORK_TESTS=1 to allow live network in this run.`,
      );
    }
    return originalFetch(input as RequestInfo, init);
  };
  return guarded as unknown as typeof fetch;
}

export function installNetworkGuard(): void {
  if (process.env.ALLOW_NETWORK_TESTS === "1") return;
  globalThis.fetch = createGuardedFetch(globalThis.fetch);
}

installNetworkGuard();
