/**
 * The landing page's playable story: break something, watch Saathi fix it.
 * Scenario data is sample data; the timeline is a pure function so it is easy to test.
 */
export type StoryId = "soundbox" | "bill" | "settlement" | "card";
export type Phase = "healthy" | "broken" | "fixing" | "fixed" | "approved";

export interface Story {
  id: StoryId;
  label: string;
  breakLabel: string;
  /** the tile that changes on the dashboard */
  tile: { label: string; healthy: string; broken: string; fixed: string };
  /** the row/panel that changes on the dashboard */
  panel: { title: string; healthy: string; broken: string; fixed: string };
  alert: { title: string; body: string };
  ask: string;
  ack: string;
  steps: { kind: string; text: string }[];
  reply: string;
  proof: { label: string; ref: string }[];
  /** true when the fix ends with a person's decision (the human-in-the-loop path) */
  needsApproval: boolean;
  approvedPanel?: string;
}

export const STORIES: Story[] = [
  {
    id: "soundbox",
    label: "Soundbox goes offline",
    breakLabel: "Take the Soundbox offline",
    tile: { label: "Devices online", healthy: "1 of 1", broken: "0 of 1", fixed: "0 of 1" },
    panel: { title: "Soundbox SB-77120", healthy: "Online", broken: "Offline for 49 hours", fixed: "Replacement on the way" },
    alert: { title: "Soundbox SB-77120 is offline", body: "No signal for 49 hours, and rent was still charged." },
    ask: "Soundbox do din se band hai, aur rent bhi kat gaya.",
    ack: "Samajh gaya. Main 2 cheezein check kar raha hoon: aapka device aur rent ka charge.",
    steps: [
      { kind: "Listen", text: "Split into device fault and rent charge" },
      { kind: "Look up", text: "Offline 49 h, weak SIM signal" },
      { kind: "Decide", text: "Remote fix failed: hardware fault" },
      { kind: "Act", text: "Replacement ordered, found in logistics" },
      { kind: "Prove", text: "₹20 rent reversed, refund SUCCESS" },
      { kind: "Reply", text: "Answered in Hindi, cases closed" },
    ],
    reply: "Remote fix kaam nahi aaya, isliye naya device bhej rahe hain. 2 din ka rent ₹20 wapas kar diya hai.",
    proof: [{ label: "Replacement", ref: "RPL-4471" }, { label: "Rent refund", ref: "RV-20931" }],
    needsApproval: false,
  },
  {
    id: "bill",
    label: "A bill payment fails",
    breakLabel: "Fail the bill payment",
    tile: { label: "Open problems", healthy: "0", broken: "1", fixed: "0" },
    panel: { title: "Electricity bill ₹1,840", healthy: "Bill paid", broken: "Bill failed, money debited", fixed: "Refunded ₹1,840" },
    alert: { title: "Electricity payment failed", body: "Money was debited but the bill was not paid." },
    ask: "bijli bill ka payment fail ho gaya par paise kat gaye",
    ack: "Samajh gaya. Main check kar raha hoon: aapka bill payment.",
    steps: [
      { kind: "Listen", text: "One case: failed bill payment" },
      { kind: "Look up", text: "Biller says FAILED, ₹1,840 debited" },
      { kind: "Decide", text: "Refund allowed (limit ₹2,000)" },
      { kind: "Act", text: "Refund started on the gateway" },
      { kind: "Prove", text: "Refund status API: SUCCESS" },
      { kind: "Reply", text: "Answered in Hinglish, case closed" },
    ],
    reply: "Bill payment fail hua tha. ₹1840 ka refund ho gaya hai.",
    proof: [{ label: "Refund", ref: "RF-30417 · Success" }],
    needsApproval: false,
  },
  {
    id: "settlement",
    label: "A settlement is put on hold",
    breakLabel: "Put the settlement on hold",
    tile: { label: "Next settlement", healthy: "₹48,250", broken: "On hold", fixed: "With our team" },
    panel: { title: "Settlement ₹48,250", healthy: "Paid out", broken: "On hold: a document is missing", fixed: "Sent to the risk team" },
    alert: { title: "A settlement is on hold", body: "A payout is waiting on a missing document." },
    ask: "mera settlement ruka hua hai, paise nahi aaye",
    ack: "Samajh gaya. Main check kar raha hoon: aapka settlement.",
    steps: [
      { kind: "Listen", text: "One case: settlement on hold" },
      { kind: "Look up", text: "Held: only the GST certificate is missing" },
      { kind: "Decide", text: "Releasing a hold always needs a person" },
      { kind: "Act", text: "Asked for the one document, once" },
      { kind: "Prove", text: "Document received and verified" },
      { kind: "Reply", text: "Case sent to the risk team with evidence" },
    ],
    reply: "Document mil gaya aur sahi hai. Case humari risk team ko review ke liye bhej diya hai. Hum settlement ki tarikh ka vaada nahi kar sakte.",
    proof: [],
    needsApproval: true,
    approvedPanel: "Released by the risk team",
  },
  {
    id: "card",
    label: "A card machine goes offline",
    breakLabel: "Take the card machine offline",
    tile: { label: "Devices online", healthy: "1 of 1", broken: "0 of 1", fixed: "1 of 1" },
    panel: { title: "Card machine CM-31008", healthy: "Online", broken: "Offline: pairing lost", fixed: "Online, paired" },
    alert: { title: "Card machine CM-31008 is offline", body: "It has a signal but is not responding." },
    ask: "meri card machine swipe nahi kar rahi, offline hai",
    ack: "Samajh gaya. Main check kar raha hoon: aapki card machine.",
    steps: [
      { kind: "Listen", text: "One case: card machine fault" },
      { kind: "Look up", text: "Offline, pairing broken, signal good" },
      { kind: "Decide", text: "Re-pairing is allowed" },
      { kind: "Act", text: "Re-paired the machine" },
      { kind: "Prove", text: "Device ONLINE and pairing OK" },
      { kind: "Reply", text: "Answered in Hinglish, case closed" },
    ],
    reply: "Aapki card machine dobara pair ho gayi hai aur online hai.",
    proof: [],
    needsApproval: false,
  },
];

const TYPING_AT = 300;
const ACK_AT = 900;
const STEPS_AT = 1500;
const STEP_MS = 1000;
export const FIX_MS = STEPS_AT + 6 * STEP_MS + 800 + 700; // reply + verified

export type StepState = "pending" | "running" | "done";

export interface StoryFrame {
  typing: boolean;
  ack: boolean;
  steps: StepState[];
  reply: boolean;
  verified: boolean;
  finished: boolean;
}

export function storyFrame(elapsedMs: number): StoryFrame {
  const t = Math.max(0, elapsedMs);
  const stepsEnd = STEPS_AT + 6 * STEP_MS;
  return {
    typing: t >= TYPING_AT && t < ACK_AT,
    ack: t >= ACK_AT,
    steps: Array.from({ length: 6 }, (_, i): StepState => {
      const start = STEPS_AT + i * STEP_MS;
      return t >= start + STEP_MS ? "done" : t >= start ? "running" : "pending";
    }),
    reply: t >= stepsEnd + 300,
    verified: t >= stepsEnd + 800,
    finished: t >= FIX_MS,
  };
}

/** The phase after a user action. Invalid actions leave the phase unchanged. */
export function nextPhase(phase: Phase, action: "break" | "fix" | "done" | "approve" | "reset", story: Story): Phase {
  switch (action) {
    case "break": return phase === "healthy" ? "broken" : phase;
    case "fix": return phase === "broken" ? "fixing" : phase;
    case "done": return phase === "fixing" ? "fixed" : phase;
    case "approve": return phase === "fixed" && story.needsApproval ? "approved" : phase;
    case "reset": return "healthy";
  }
}
