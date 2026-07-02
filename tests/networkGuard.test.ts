import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGuardedFetch,
  installNetworkGuard,
  isLocalHost,
  resolveUrl,
} from "./setup/networkGuard";

describe("networkGuard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("blocks external hosts and names the host + escape hatch (OpenRouter SDK path)", () => {
    const original = vi.fn();
    const guarded = createGuardedFetch(original as unknown as typeof fetch);
    expect(() =>
      guarded("https://openrouter.ai/api/v1/chat/completions"),
    ).toThrow(/openrouter\.ai/);
    expect(() =>
      guarded("https://api.openai.com/v1/embeddings"),
    ).toThrow(/ALLOW_NETWORK_TESTS/);
    expect(original).not.toHaveBeenCalled();
  });

  it("blocks external hosts when called with a Request object (real SDK shape)", () => {
    const original = vi.fn();
    const guarded = createGuardedFetch(original as unknown as typeof fetch);
    const req = new Request("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
    });
    expect(() => guarded(req)).toThrow(/openrouter\.ai/);
    expect(original).not.toHaveBeenCalled();
  });

  it("blocks the real OpenAI SDK client with a dummy key (not raw fetch)", async () => {
    // Relies on the AMBIENT global guard installed by the setup file (no fetch
    // stub here) — this proves the guard covers the actual SDK call path, which
    // routes through globalThis.fetch. maxRetries: 0 keeps it deterministic.
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: "dummy-key-for-test",
      baseURL: "https://openrouter.ai/api/v1",
      maxRetries: 0,
    });
    let caught: unknown;
    try {
      await client.chat.completions.create({
        model: "anthropic/claude-sonnet-4.5",
        messages: [{ role: "user", content: "ping" }],
      });
    } catch (error) {
      caught = error;
    }
    // The OpenAI SDK wraps any synchronous fetch throw into its own
    // APIConnectionError with message "Connection error." — that wrapper
    // masks the guard's message on `.message`. Its `.cause`, however, is the
    // exact Error thrown by networkGuard, which proves the guard (not a real
    // network failure — there is no DNS/ECONNREFUSED here) is what rejected
    // the call.
    expect(caught).toBeInstanceOf(Error);
    const cause = (caught as Error & { cause?: Error }).cause;
    expect(cause?.message).toMatch(/networkGuard|ALLOW_NETWORK_TESTS|openrouter\.ai/);
  });

  it("allows localhost / 127.0.0.1 / ::1 / 0.0.0.0 and relative URLs", async () => {
    const original = vi.fn().mockResolvedValue(new Response("ok"));
    const guarded = createGuardedFetch(original as unknown as typeof fetch);
    await guarded("http://localhost:5173/api/coach-agent");
    await guarded("http://127.0.0.1:4173/x");
    await guarded("http://[::1]:5173/x");
    await guarded("http://0.0.0.0:5173/x");
    await guarded("/api/coach-agent");
    expect(original).toHaveBeenCalledTimes(5);
  });

  it("isLocalHost + resolveUrl helpers behave", () => {
    expect(isLocalHost("localhost")).toBe(true);
    expect(isLocalHost("127.0.0.1")).toBe(true);
    expect(isLocalHost("::1")).toBe(true);
    expect(isLocalHost("0.0.0.0")).toBe(true);
    expect(isLocalHost("openrouter.ai")).toBe(false);
    expect(resolveUrl("https://x.dev/y")).toBe("https://x.dev/y");
    expect(resolveUrl(new URL("https://x.dev/y"))).toBe("https://x.dev/y");
    expect(resolveUrl(new Request("https://x.dev/y"))).toBe("https://x.dev/y");
  });

  it("escape hatch: ALLOW_NETWORK_TESTS=1 leaves fetch unwrapped; unset wraps + enforces", () => {
    const sentinel = vi.fn() as unknown as typeof fetch;
    // Hatch ON → install is a no-op: fetch stays the sentinel.
    vi.stubEnv("ALLOW_NETWORK_TESTS", "1");
    vi.stubGlobal("fetch", sentinel);
    installNetworkGuard();
    expect(globalThis.fetch).toBe(sentinel);
    // Hatch OFF → install wraps: fetch is replaced and enforces the guard.
    vi.stubEnv("ALLOW_NETWORK_TESTS", "");
    vi.stubGlobal("fetch", sentinel);
    installNetworkGuard();
    expect(globalThis.fetch).not.toBe(sentinel);
    expect(() =>
      (globalThis.fetch as typeof fetch)("https://openrouter.ai/x"),
    ).toThrow(/openrouter\.ai/);
    vi.unstubAllGlobals();
  });
});
