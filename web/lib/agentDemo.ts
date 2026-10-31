/**
 * The hero walkthrough as a pure function of time, so it is trivial to test and to scrub.
 * It mirrors the pitch's headline scenario. The numbers and references are sample data.
 */
export const TOTAL_MS = 18_000;

export const TRANSCRIPT = "Soundbox do din se band hai, aur rent bhi kat gaya.";
export const ACK = "Samajh gaya. Main 2 cheezein check kar raha hoon: aapka device aur rent ka charge.";
export const REPLY = "Remote fix kaam nahi aaya, isliye naya device bhej rahe hain. 2 din ka rent ₹20 wapas kar diya hai.";

export const STEPS = [
  { at: "0:02", kind: "Listen", text: "Heard the voice note and split it into 2 cases: device fault and rent charge", short: "Heard the note, split into 2 cases" },
  { at: "0:05", kind: "Look up", text: "Device offline for 49 hours, weak SIM signal", short: "Device offline 49 h, weak SIM" },
  { at: "0:12", kind: "Decide", text: "Remote fix tried and failed, so it is a hardware fault. Rules allow a replacement", short: "Remote fix failed: hardware fault" },
  { at: "0:18", kind: "Act", text: "Replacement order created. Checked: order found in the logistics system", short: "Replacement ordered, found in logistics" },
  { at: "0:24", kind: "Prove", text: "Reversed ₹20 rent, under the ₹500 limit. Checked: refund status SUCCESS", short: "₹20 rent reversed, refund SUCCESS" },
  { at: "0:31", kind: "Reply", text: "Answered in Hindi with both reference numbers and closed the cases", short: "Replied in Hindi, cases closed" },
] as const;

const VOICE_START = 500;
const TRANSCRIPT_START = 1100;
const TRANSCRIPT_END = 3000;
const TYPING_START = 3300;
const ACK_AT = 4100;
const STEPS_START = 4600;
const STEP_MS = 1450;
const RESULT_AT = STEPS_START + STEPS.length * STEP_MS + 300; // 13,600

export type StepState = "pending" | "running" | "done";

export interface Frame {
  voice: boolean;
  recording: boolean; // waveform animating
  transcriptChars: number;
  typing: boolean;
  ack: boolean;
  steps: StepState[];
  result: boolean;
  verified: boolean;
  progress: number; // 0..1
}

export function frameAt(tMs: number): Frame {
  const t = Math.max(0, Math.min(TOTAL_MS, tMs));
  const chars = Math.round(
    TRANSCRIPT.length * Math.min(1, Math.max(0, (t - TRANSCRIPT_START) / (TRANSCRIPT_END - TRANSCRIPT_START))),
  );
  const steps = STEPS.map((_, i): StepState => {
    const start = STEPS_START + i * STEP_MS;
    return t >= start + STEP_MS ? "done" : t >= start ? "running" : "pending";
  });
  const result = t >= RESULT_AT;
  return {
    voice: t >= VOICE_START,
    recording: t >= VOICE_START && t < TRANSCRIPT_END,
    transcriptChars: chars,
    typing: t >= TYPING_START && t < ACK_AT,
    ack: t >= ACK_AT,
    steps,
    result,
    verified: result && t >= RESULT_AT + 500,
    progress: t / TOTAL_MS,
  };
}

export const ALT_TEXT =
  "A short walkthrough: a merchant sends a Hindi-English voice note saying their Soundbox has been off for two days and rent was still deducted. Saathi splits it into two cases, looks up the device, tries a remote fix, creates a replacement order, reverses ₹20 of rent, checks that both really worked, and replies with the two reference numbers.";
