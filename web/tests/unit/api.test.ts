import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, merchantApi, request, staffApi } from "@/lib/api";

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("request", () => {
  it("sends the bearer token and JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ conversation_id: 1, message_id: 2, case_ids: [3] }));
    vi.stubGlobal("fetch", fetchMock);
    await merchantApi("tok").send("hi", "voice", null);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/messages$/);
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ text: "hi", input_mode: "voice", conversation_id: null });
  });

  it("turns the API error envelope into an ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ error: { code: "already_decided", message: "Already decided" } }, 409)));
    await expect(request("/v1/x")).rejects.toMatchObject({ status: 409, code: "already_decided", message: "Already decided" });
  });

  it("survives a non-JSON error body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 })));
    const err = (await request("/v1/x").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.message).not.toContain("<html>");
  });

  it("reports network failures in plain language", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(request("/v1/x")).rejects.toMatchObject({ status: 0, code: "network" });
  });

  it("omits empty filters from query strings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ items: [], total: 0, limit: 15, offset: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    await staffApi("t").cases({ status: "", product: undefined, limit: 15, offset: 0 });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/v1\/cases\?limit=15&offset=0$/);
  });
});
