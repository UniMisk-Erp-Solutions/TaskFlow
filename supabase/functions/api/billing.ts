// Pure billing rules (no database, no network) so the API and the tests share one definition of "locked".

export const TRIAL_DAYS = 7;

export type OrgBilling = {
  plan?: string | null;
  plan_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_used?: boolean | null;
  paid_until?: string | null;
};

export type AccessState = {
  plan: "free" | "pro" | "business";
  /** none = nothing to pay for, trialing, active = paid, expired = trial over or payment lapsed. */
  status: "none" | "trialing" | "active" | "expired";
  /** True when the workspace must pay before it can use protected features. Decided here, never by the browser. */
  locked: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  trialEligible: boolean;
  paidUntil: string | null;
};

const DAY_MS = 86_400_000;

export function accessState(org: OrgBilling | null | undefined, now: Date = new Date()): AccessState {
  const plan = org?.plan === "pro" || org?.plan === "business" ? org.plan : "free";
  const raw = org?.plan_status;
  let status: AccessState["status"] = raw === "trialing" || raw === "active" || raw === "expired" ? raw : "none";
  const trialEnd = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const paidUntil = org?.paid_until ? new Date(org.paid_until) : null;

  if (status === "trialing" && (!trialEnd || trialEnd.getTime() <= now.getTime())) status = "expired";
  if (status === "active" && paidUntil && paidUntil.getTime() <= now.getTime()) status = "expired";

  const locked = status === "expired";
  const trialDaysLeft = status === "trialing" && trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / DAY_MS)) : null;
  return {
    plan,
    status,
    locked,
    trialEndsAt: org?.trial_ends_at ?? null,
    trialDaysLeft,
    trialEligible: plan === "free" && status === "none" && !org?.trial_used,
    paidUntil: org?.paid_until ?? null,
  };
}

// ── Business enquiry form ────────────────────────────────────────────────────────────────────────
export const TEAM_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;
export const CONTACT_METHODS = ["email", "phone", "whatsapp"] as const;
export const REQUIRED_FEATURES = [
  "Manager role and teams",
  "Two-step approval",
  "Leave portal",
  "File sharing",
  "Team chat",
  "AI assistant",
  "Calendar",
  "Time tracking",
  "Other",
] as const;

export type BusinessInquiry = {
  name: string;
  work_email: string;
  company: string;
  job_title: string;
  team_size: string;
  requirements: string;
  required_features: string[];
  contact_method: string;
  phone: string | null;
  budget: string | null;
  message: string | null;
};

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
// Strips control characters (and zero-width ones) so a pasted value cannot hide anything.
// eslint-disable-next-line no-control-regex
const CLEAN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028\u2029]/g;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(CLEAN, "").trim().slice(0, max + 1) : "";
}

export function validateInquiry(body: unknown): { ok: true; value: BusinessInquiry } | { ok: false; errors: Record<string, string> } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const name = text(b.name, 100);
  if (name.length < 2) errors.name = "Please enter your name.";
  else if (name.length > 100) errors.name = "Name must be 100 characters or fewer.";

  const work_email = text(b.work_email, 254).toLowerCase();
  if (!EMAIL.test(work_email) || work_email.length > 254) errors.work_email = "Please enter a valid work email.";

  const company = text(b.company, 150);
  if (company.length < 2) errors.company = "Please enter your company.";
  else if (company.length > 150) errors.company = "Company must be 150 characters or fewer.";

  const job_title = text(b.job_title, 100);
  if (job_title.length < 2) errors.job_title = "Please enter your job title.";
  else if (job_title.length > 100) errors.job_title = "Job title must be 100 characters or fewer.";

  const team_size = text(b.team_size, 20);
  if (!(TEAM_SIZES as readonly string[]).includes(team_size)) errors.team_size = "Please choose your team size.";

  const requirements = text(b.requirements, 2000);
  if (requirements.length < 10) errors.requirements = "Please tell us a little about what you need (at least 10 characters).";
  else if (requirements.length > 2000) errors.requirements = "Requirements must be 2000 characters or fewer.";

  const featuresIn = Array.isArray(b.required_features) ? b.required_features : [];
  const required_features = [...new Set(featuresIn.filter((f): f is string => typeof f === "string"))];
  if (required_features.some((f) => !(REQUIRED_FEATURES as readonly string[]).includes(f))) {
    errors.required_features = "One of the selected features is not valid.";
  }

  const contact_method = text(b.contact_method, 20);
  if (!(CONTACT_METHODS as readonly string[]).includes(contact_method)) errors.contact_method = "Please choose how we should contact you.";

  const phoneRaw = text(b.phone, 30);
  const phone = phoneRaw || null;
  if (phone && !/^[+()\d][\d\s().-]{5,28}$/.test(phone)) errors.phone = "Please enter a valid phone number.";
  if ((contact_method === "phone" || contact_method === "whatsapp") && !phone) errors.phone = "Please enter a phone number so we can reach you.";

  const budget = text(b.budget, 100) || null;
  if (budget && budget.length > 100) errors.budget = "Budget must be 100 characters or fewer.";

  const message = text(b.message, 2000) || null;
  if (message && message.length > 2000) errors.message = "Message must be 2000 characters or fewer.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { name, work_email, company, job_title, team_size, requirements, required_features, contact_method, phone, budget, message },
  };
}
