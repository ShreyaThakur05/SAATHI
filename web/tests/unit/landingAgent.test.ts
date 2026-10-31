import { describe, expect, it } from "vitest";
import { detectLanguage, replyTo } from "@/lib/landingAgent";

describe("detectLanguage", () => {
  it("tells Hindi, Hinglish and English apart", () => {
    expect(detectLanguage("मेरा साउंडबॉक्स बंद है")).toBe("hi");
    expect(detectLanguage("Soundbox do din se band hai")).toBe("hinglish");
    expect(detectLanguage("My soundbox stopped working")).toBe("en");
  });
});

describe("the landing agent always asks the visitor to sign in first", () => {
  it("acknowledges the problem in the visitor's language and offers merchant sign-in", () => {
    const en = replyTo("My Soundbox is offline and rent was deducted", 0);
    expect(en.text).toMatch(/your Soundbox and the rent charge/);
    expect(en.text).toMatch(/sign in first/);
    expect(en.ctas).toEqual(["merchant"]);
    expect(replyTo("Mera settlement ruka hua hai", 0).text).toMatch(/aapke settlement/);
    expect(replyTo("मेरा सेटलमेंट रुका हुआ है", 0).text).toMatch(/साइन इन/);
  });
  it("sends support staff to the team console", () => {
    const r = replyTo("I'm on the support team", 0);
    expect(r.ctas[0]).toBe("console");
    expect(r.text).toMatch(/team console/);
  });
  it("never invites a PIN or OTP, and tells the visitor not to share one", () => {
    const r = replyTo("my otp is 482913", 0);
    expect(r.text).toMatch(/never asks/);
    expect(r.text).not.toMatch(/482913/);
  });
  it("still asks for sign-in when it cannot tell what the problem is, and varies on repeat", () => {
    const first = replyTo("hello", 0);
    const again = replyTo("hello?", 1);
    expect(first.text).toMatch(/sign in/);
    expect(again.text).not.toBe(first.text);
    expect(again.ctas).toEqual(["merchant"]);
  });
  it("makes no claim of having looked at an account", () => {
    for (const msg of ["soundbox band hai", "bill failed", "hello", "loan emi"]) {
      expect(replyTo(msg, 0).text).not.toMatch(/I (checked|looked|fixed|found)/i);
    }
  });
});
