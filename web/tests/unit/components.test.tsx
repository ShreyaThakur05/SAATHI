import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StatusCard } from "@/components/StatusCard";
import { StatusPill } from "@/components/StatusPill";
import { SixStepBar, StepList } from "@/components/Timeline";
import type { ChatCard, Step } from "@/lib/types";

const step = (seq: number, kind: Step["kind"], status: Step["status"] = "OK", title = `${kind} step`): Step => ({
  seq,
  kind,
  status,
  title,
  detail: kind === "ACT" ? { reference: "RV-20931" } : {},
  created_at: new Date(Date.UTC(2026, 9, 30, 12, 0, seq * 3)).toISOString(),
});

describe("StatusPill", () => {
  it("labels every state in words, not just colour", () => {
    render(<StatusPill status="AWAITING_APPROVAL" />);
    expect(screen.getByText("Needs a person")).toBeInTheDocument();
  });
});

describe("SixStepBar", () => {
  it("lights up only the steps that happened", () => {
    render(<SixStepBar steps={[step(1, "LISTEN"), step(2, "UNDERSTAND"), step(3, "LOOKUP")]} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(screen.getByText("Listen")).toHaveClass("bg-navy-2");
    expect(screen.getByText("Prove")).toHaveClass("bg-surface");
  });
  it("shows a failed proof as failed, not done", () => {
    render(<SixStepBar steps={[step(1, "PROVE", "FAILED")]} />);
    expect(screen.getByText("Prove")).toHaveClass("bg-danger");
  });
});

describe("StepList", () => {
  it("shows an elapsed clock and reveals evidence on click", async () => {
    render(<StepList steps={[step(1, "LISTEN"), step(2, "ACT", "OK", "Reverse rent")]} />);
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("0:03")).toBeInTheDocument();
    expect(screen.queryByText("RV-20931")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Reverse rent/ }));
    expect(screen.getByText("RV-20931")).toBeInTheDocument();
  });
  it("renders nothing for an empty timeline", () => {
    const { container } = render(<StepList steps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

const card = (over: Partial<ChatCard> = {}): ChatCard => ({ state: "resolved", case_ids: [1], items: [], uploads: [], ...over });

describe("StatusCard", () => {
  it("shows references with their proof note", () => {
    render(<StatusCard lang="en" card={card({ items: [{ label: "Refund", ref: "RV-20931", note: "Success" }] })} />);
    expect(screen.getByText("RV-20931")).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });
  it("renders in Hindi", () => {
    render(<StatusCard lang="hi" card={card({ items: [{ label: "Refund", ref: "RV-1", note: "" }] })} />);
    expect(screen.getByText("हो गया")).toBeInTheDocument();
  });
  it("words the upload button naturally in each language", () => {
    const waiting = card({ state: "waiting", uploads: [{ case_id: 1, doc_type: "GST" }] });
    const { rerender } = render(<StatusCard lang="hinglish" card={waiting} />);
    expect(screen.getByRole("button", { name: "GST certificate upload karein" })).toBeInTheDocument();
    rerender(<StatusCard lang="hi" card={waiting} />);
    expect(screen.getByRole("button", { name: "GST प्रमाणपत्र अपलोड करें" })).toBeInTheDocument();
  });
  it("renders nothing for an empty resolved card", () => {
    const { container } = render(<StatusCard lang="en" card={card()} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("still labels a blocked or escalated reply that has no references", () => {
    render(<StatusCard lang="en" card={card({ state: "blocked" })} />);
    expect(screen.getByText("Not done")).toBeInTheDocument();
  });
  it("uploads the requested document once and then disables the button", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(<StatusCard lang="en" onUpload={onUpload} card={card({ state: "waiting", uploads: [{ case_id: 7, doc_type: "GST" }] })} />);
    await userEvent.click(screen.getByRole("button", { name: /Upload GST certificate/ }));
    expect(onUpload).toHaveBeenCalledExactlyOnceWith(7, "GST");
    expect(await screen.findByRole("button", { name: "Sent" })).toBeDisabled();
  });
  it("shows the server's message when an upload fails", async () => {
    const { ApiError } = await import("@/lib/api");
    const onUpload = vi.fn().mockRejectedValue(new ApiError(409, "not_waiting", "This case is not waiting for that document"));
    render(<StatusCard lang="en" onUpload={onUpload} card={card({ state: "waiting", uploads: [{ case_id: 7, doc_type: "GST" }] })} />);
    await userEvent.click(screen.getByRole("button", { name: /Upload/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not waiting");
    expect(screen.getByRole("button", { name: /Upload/ })).toBeEnabled(); // can retry
  });
});
