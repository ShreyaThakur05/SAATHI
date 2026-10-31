import { describe, expect, it } from "vitest";
import { itemText, uploadLabel } from "@/lib/i18n";

describe("chat card text follows the chat language", () => {
  it("translates the known labels and leaves references alone", () => {
    expect(itemText("Replacement", "hi")).toBe("रिप्लेसमेंट");
    expect(itemText("Success", "hinglish")).toBe("Safal");
    expect(itemText("Refund", "en")).toBe("Refund");
    expect(itemText("RPL-4471", "hi")).toBe("RPL-4471");
  });
  it("words the upload button per language", () => {
    expect(uploadLabel("GST", "en")).toBe("Upload GST certificate");
    expect(uploadLabel("UNKNOWN_DOC", "en")).toBe("Upload UNKNOWN_DOC");
  });
});
