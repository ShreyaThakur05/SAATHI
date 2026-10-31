import { API_URL } from "./config";
import type {
  ActionRow,
  Lang,
  Approval,
  AuditEntry,
  CaseDetail,
  CaseSummary,
  ChatMessage,
  HelpRequest,
  LedgerItem,
  MerchantBill,
  MerchantDevice,
  MerchantOverview,
  MerchantSettlements,
  Metrics,
  Page,
  SkillPack,
  StaffUser,
  SystemStatus,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Options {
  method?: "GET" | "POST";
  token?: string | null;
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<T>(path: string, opts: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach Saathi right now. Check your connection.");
  }
  if (!res.ok) {
    let code = "http_error";
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      code = data?.error?.code ?? code;
      message = data?.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
};

// ---- staff (team console)
export const staffApi = (token: string | null) => ({
  login: (email: string, password: string) =>
    request<{ token: string; user: StaffUser }>("/v1/auth/login", { method: "POST", body: { email, password } }),
  me: () => request<StaffUser>("/v1/me", { token }),
  cases: (p: { status?: string; product?: string; limit?: number; offset?: number } = {}) =>
    request<Page<CaseSummary>>(`/v1/cases${qs(p)}`, { token }),
  caseDetail: (id: number) => request<CaseDetail>(`/v1/cases/${id}`, { token }),
  approvals: (status: "PENDING" | "APPROVED" | "REJECTED", offset = 0) =>
    request<Page<Approval>>(`/v1/approvals${qs({ status, offset })}`, { token }),
  decide: (id: number, approve: boolean, note?: string) =>
    request<CaseSummary>(`/v1/approvals/${id}/decision`, { method: "POST", token, body: { approve, note } }),
  audit: (p: { case_id?: number; event?: string; limit?: number; offset?: number }) =>
    request<Page<AuditEntry>>(`/v1/audit${qs(p)}`, { token }),
  metrics: () => request<Metrics>("/v1/metrics", { token }),
  skillPacks: () => request<SkillPack[]>("/v1/skill-packs", { token }),
  systemStatus: () => request<SystemStatus>("/v1/system/status", { token }),
  demoReset: () => request<{ seeded: Record<string, number> }>("/v1/demo/reset", { method: "POST", token }),
});

export const merchantLogin = (email: string, password: string) =>
  request<{ token: string; merchant: { id: number; name: string; language: Lang } }>("/v1/merchant/login", {
    method: "POST",
    body: { email, password },
  });

// ---- merchant (dashboard and chat)
export const merchantApi = (token: string) => ({
  overview: () => request<MerchantOverview>("/v1/merchant/overview", { token }),
  devices: () => request<MerchantDevice[]>("/v1/merchant/devices", { token }),
  settlements: () => request<MerchantSettlements>("/v1/merchant/settlements", { token }),
  bills: () => request<MerchantBill[]>("/v1/merchant/bills", { token }),
  activity: () => request<LedgerItem[]>("/v1/merchant/activity", { token }),
  helpRequests: () => request<HelpRequest[]>("/v1/merchant/help-requests", { token }),
  send: (text: string, inputMode: "text" | "voice", conversationId: number | null) =>
    request<{ conversation_id: number; message_id: number; case_ids: number[] }>("/v1/messages", {
      method: "POST",
      token,
      body: { text, input_mode: inputMode, conversation_id: conversationId },
    }),
  messages: (after: number) => request<ChatMessage[]>(`/v1/conversations/latest/messages${qs({ after })}`, { token }),
  uploadDocument: (caseId: number, docType: string) =>
    request<CaseSummary>(`/v1/cases/${caseId}/documents`, { method: "POST", token, body: { doc_type: docType } }),
});

export type { ActionRow };
