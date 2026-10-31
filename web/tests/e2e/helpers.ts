import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API = "http://localhost:8000";
export const PASSWORD = "saathi-demo";

let adminToken: string | null = null;

export async function getAdminToken(request: APIRequestContext) {
  if (!adminToken) {
    const login = await request.post(`${API}/v1/auth/login`, { data: { email: "admin@paytm.demo", password: PASSWORD } });
    expect(login.ok()).toBeTruthy();
    adminToken = (await login.json()).token as string;
  }
  return adminToken;
}

export async function resetDemo(request: APIRequestContext) {
  const token = await getAdminToken(request);
  const res = await request.post(`${API}/v1/demo/reset`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.ok()).toBeTruthy();
}

/** Fail the test on unexpected browser console errors or uncaught exceptions. */
export function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/Failed to load resource.*(401|404|409)/.test(text)) return; // expected in negative-path tests
    problems.push(`console.error: ${text}`);
  });
  return problems;
}

export async function loginMerchant(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

export async function loginStaff(page: Page, email: string) {
  await page.goto("/console/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Cases" })).toBeVisible();
}

export const chat = (page: Page) => page.getByRole("dialog", { name: "Saathi help chat" });

/** Click an alert's "Resolve with Saathi" and wait for the chat to open. */
export async function resolveWithSaathi(page: Page, alertTitle: RegExp) {
  const alert = page.getByRole("alert").filter({ hasText: alertTitle });
  await alert.getByRole("button", { name: "Resolve with Saathi" }).click();
  await expect(chat(page)).toBeVisible();
}

export async function closeChat(page: Page) {
  await chat(page).getByRole("button", { name: "Close chat" }).click();
  await expect(chat(page)).toBeHidden();
}
