import { describe, expect, it } from "vitest";
import { parseEmbedHash } from "@/lib/embed";

describe("parseEmbedHash", () => {
  it("reads token, language, accent colour and host origin", () => {
    const p = parseEmbedHash("#token=abc.def&lang=hi&primary=%2300b9f5&host=https%3A%2F%2Fdash.example.com%2Fpage");
    expect(p).toEqual({ token: "abc.def", lang: "hi", primary: "#00b9f5", hostOrigin: "https://dash.example.com" });
  });
  it("falls back safely on bad input", () => {
    const p = parseEmbedHash("#lang=klingon&primary=red;background:url(x)&host=not a url");
    expect(p.token).toBeNull();
    expect(p.lang).toBe("hinglish");
    expect(p.primary).toBeNull(); // never lets a host inject arbitrary CSS
    expect(p.hostOrigin).toBeNull();
  });
  it("handles an empty hash", () => expect(parseEmbedHash("").token).toBeNull());
});
