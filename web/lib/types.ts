export type Lang = "hi" | "hinglish" | "en";

export type CaseStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_MERCHANT"
  | "AWAITING_APPROVAL"
  | "RESOLVED"
  | "REJECTED"
  | "BLOCKED"
  | "FAILED";

export type StepKind =
  | "LISTEN"
  | "UNDERSTAND"
  | "LOOKUP"
  | "DECIDE"
  | "ACT"
  | "PROVE"
  | "HANDOFF"
  | "REPLY";

export interface StaffUser {
  id: number;
  email: string;
  name: string;
  role: "AGENT" | "RISK_APPROVER" | "ADMIN";
}

export interface CaseSummary {
  id: number;
  merchant_id: number;
  merchant_name: string | null;
  product: string;
  intent: string;
  status: CaseStatus;
  summary: string;
  language: Lang;
  handled_by_person: boolean;
  injection_suspected: boolean;
  understanding_mode: "claude" | "sarvam" | "keyword";
  ai_cost_inr: string;
  refund_deadline_at: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Step {
  seq: number;
  kind: StepKind;
  status: "OK" | "FAILED" | "INFO";
  title: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface ActionRow {
  id: number;
  name: string;
  idempotency_key: string;
  amount_inr: string | null;
  status: string;
  reference: string | null;
  proved: boolean | null;
  approved_by_user_id: number | null;
  created_at: string;
}

export interface Approval {
  id: number;
  case_id: number;
  action: string;
  amount_inr: string | null;
  rule_id: string;
  reason: string;
  evidence: Record<string, unknown>;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_at: string;
  decided_at: string | null;
  decision_note: string | null;
  decided_by: string | null;
  case_summary: string | null;
  merchant_name: string | null;
}

export interface ChatCard {
  state: "resolved" | "escalated" | "waiting" | "blocked";
  case_ids: number[];
  items: { label: string; ref: string; note: string }[];
  uploads: { case_id: number; doc_type: string }[];
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  role: "MERCHANT" | "SAATHI";
  text: string;
  input_mode: "text" | "voice";
  card: ChatCard | null;
  case_id: number | null;
  created_at: string;
}

export interface CaseDetail {
  case: CaseSummary;
  steps: Step[];
  actions: ActionRow[];
  approvals: Approval[];
  messages: ChatMessage[];
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditEntry {
  id: number;
  ts: string;
  actor: string;
  event: string;
  case_id: number | null;
  data: Record<string, unknown>;
}

export interface Rate {
  count: number;
  rate: number | null;
}

export interface Metrics {
  cases_total: number;
  by_status: Record<string, number>;
  by_product: Record<string, number>;
  solved_without_person: Rate;
  actions_confirmed_success: { confirmed: number; attempted: number; rate: number | null };
  median_time_to_resolve_s: number | null;
  ai_cost_per_resolved_ticket_inr: string | null;
  repeat_contact_within_7d: Rate;
  refunds: { tracked: number; open: number; past_deadline: number };
  awaiting_person: number;
  understanding_modes: Record<string, number>;
  illustrative: { human_cost_per_ticket_inr: string; estimated_saving_inr: string; note: string };
}

export interface SkillPack {
  skill_pack: string;
  title: string;
  status: "live" | "roadmap";
  version: number;
  product: string;
  intents: string[];
  allowed_actions: string[];
  action_limits_inr: Record<string, string>;
  requires_person: string[];
  hand_off_if: string[];
  proof: Record<string, string>;
  max_prior_claims: number;
  source_yaml: string;
}

// ---- merchant dashboard
export type Money = string | number;

export interface MerchantAlert {
  id: string;
  severity: "critical" | "warning";
  kind: "device_offline" | "settlement_held" | "bill_failed";
  title: string;
  body: string;
  ask: string;
}

export interface LedgerItem {
  id: string;
  ts: string;
  kind: "payment_received" | "settlement" | "rent_charge" | "rent_reversal" | "bill_payment" | "refund";
  title: string;
  subtitle: string;
  amount_inr: Money;
  status: string;
  reference: string | null;
}

export interface MerchantOverview {
  merchant: { id: number; name: string; city: string; category: string; language: Lang; kyc_status: string };
  collections: { today_inr: Money; today_count: number; week_inr: Money; week_count: number };
  devices: { total: number; online: number };
  settlement: {
    held: { id: number; amount_inr: Money; status: string; hold_reason: string | null; created_at: string } | null;
    last_paid: { id: number; amount_inr: Money; status: string; created_at: string } | null;
  };
  open_help_requests: number;
  alerts: MerchantAlert[];
}

export interface MerchantDevice {
  id: number;
  kind: "SOUNDBOX" | "CARD_MACHINE";
  serial: string;
  status: "ONLINE" | "OFFLINE";
  offline_hours: number;
  sim_signal: string;
  pairing_ok: boolean;
  last_seen_at: string;
  monthly_rent_inr: Money | null;
  replacement: { reference: string; status: string; eta_date: string } | null;
}

export interface MerchantSettlements {
  settlements: { id: number; amount_inr: Money; status: "PAID" | "HELD" | "RELEASED"; hold_reason: string | null; created_at: string }[];
  documents: { doc_type: string; status: "VERIFIED" | "MISSING" | "MISMATCH" }[];
}

export interface MerchantBill {
  txn: string;
  biller: string;
  amount_inr: Money;
  debited: boolean;
  biller_status: "SUCCESS" | "FAILED" | "PENDING";
  paid_at: string;
  refund: { refund_id: string; status: "PENDING" | "SUCCESS" | "FAILURE"; amount_inr: Money } | null;
}

export interface HelpRequest {
  id: number;
  summary: string;
  product: string;
  status: CaseStatus;
  created_at: string;
  resolved_at: string | null;
  references: string[];
  waiting_for: string | null;
  steps: { kind: StepKind; status: "OK" | "FAILED" | "INFO"; title: string; at: string }[];
}

export interface SystemStatus {
  env: string;
  version: string;
  understanding: { mode: "claude" | "sarvam" | "keyword"; model: string | null };
  integrations: { name: string; kind: "simulated" | "live" | "not_configured"; detail: string }[];
  demo_tools_enabled: boolean;
  sim_latency_ms: number;
}

// ---- profile, location, diagnostics
export type HopState = "ok" | "degraded" | "down";

export interface Diagnostics {
  source: string;
  device: { id: number; kind: "SOUNDBOX" | "CARD_MACHINE"; serial: string; status: "ONLINE" | "OFFLINE"; pairing_ok: boolean };
  signal: { quality: "GOOD" | "WEAK" | "NONE"; dbm: number };
  heartbeat: {
    interval_s: number;
    last_seen_at: string;
    median_rtt_ms: number | null;
    missed_recent: number;
    window: number;
    series: { t: string; rtt_ms: number | null }[];
  };
  path: { device: "ok" | "fault"; link_tower: HopState; link_gateway: HopState; failing_hop: "device" | "device_tower" | null };
  work: {
    case_id: number;
    summary: string;
    status: CaseStatus;
    active: boolean;
    steps: { seq: number; kind: StepKind; status: "OK" | "FAILED" | "INFO"; title: string; at: string }[];
  } | null;
  as_of: string;
}

export interface HistoryEvent {
  ts: string;
  kind: "case" | "device" | "money" | "kyc" | "account" | "action";
  title: string;
  detail: string;
  status: string;
}

export interface MerchantProfile {
  merchant: {
    id: number;
    name: string;
    email: string | null;
    category: string;
    city: string;
    address: string;
    language: Lang;
    kyc_status: string;
    member_since: string;
  };
  stats: { collections_inr: Money; collections_count: number; devices: number; requests: number; resolved: number; solved_by_saathi: number };
  location: {
    source: string;
    shop: { lat: number; lng: number; label: string };
    devices: { id: number; kind: string; serial: string; status: string; lat: number; lng: number }[];
    tower: { lat: number; lng: number; label: string };
  } | null;
  devices: MerchantDevice[];
  history: HistoryEvent[];
}

export interface MerchantListItem {
  id: number;
  name: string;
  city: string;
  category: string;
  kyc_status: string;
  open_cases: number;
}
