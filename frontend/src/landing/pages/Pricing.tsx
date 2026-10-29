import { useState } from "react";
import { motion } from "motion/react";
import { Check, ArrowRight, Minus } from "lucide-react";
import { Button } from "../components/ui/Button";
import { useAuth } from "../../AuthContext";
import { useBilling } from "../../BillingContext";
import BusinessInquiryModal from "../components/BusinessInquiryModal";
import {
  PageShell, Container, Section, PageHeader, SectionHead,
  BRAND, tone, display,
} from "../lib/ui";

type Cycle = "monthly" | "yearly";

type PlanKey = "free" | "pro" | "business";

const plans: Array<{
  key: PlanKey; name: string; pitch: string; monthly: number | null; yearly: number | null;
  cta: string; href: string; accent: boolean; features: string[]; lead?: string;
}> = [
  {
    key: "free",
    name: "Free",
    pitch: "For solo creators or two-person teams.",
    monthly: 0,
    yearly: 0,
    cta: "Get Started",
    href: "/login?mode=signup",
    accent: false,
    features: ["Up to 3 projects", "Unlimited tasks", "List & board views", "Team chat & file sharing", "Mobile app with push notifications"],
  },
  {
    key: "pro",
    name: "Pro",
    pitch: "For teams that ship every week.",
    monthly: 12,
    yearly: 10,
    cta: "Start 7-Day Free Trial",
    href: "/login?mode=signup&next=/pricing",
    accent: true,
    lead: "Everything in Free, plus:",
    features: ["Unlimited projects", "Calendar view", "AI assistant", "Time tracking & timer analytics", "Approval workflow & history"],
  },
  {
    key: "business",
    name: "Business",
    pitch: "For organizations that run work through teams and managers.",
    monthly: null,
    yearly: null,
    cta: "Contact Team Unimisk",
    href: "/contact",
    accent: false,
    lead: "Everything in Pro, plus:",
    features: ["Manager role and teams", "Two-step approval: manager, then admin", "Leave portal with team leave summaries", "Public and private file sharing", "Set up around your team size"],
  },
];

const comparisonRows: Array<{ label: string; values: [string | boolean, string | boolean, string | boolean] }> = [
  { label: "Projects", values: ["3", "Unlimited", "Unlimited"] },
  { label: "Members", values: ["5", "Unlimited", "Unlimited"] },
  { label: "List & board views", values: [true, true, true] },
  { label: "Team chat & file sharing", values: [true, true, true] },
  { label: "Push notifications", values: [true, true, true] },
  { label: "Calendar view", values: [false, true, true] },
  { label: "AI assistant", values: [false, true, true] },
  { label: "Time tracking & analytics", values: [false, true, true] },
  { label: "Approval workflow", values: [false, "Admin review", "Manager, then admin"] },
  { label: "Manager role & teams", values: [false, false, true] },
  { label: "Leave portal", values: [false, false, true] },
];

const faqs = [
  { q: "Can I switch plans anytime?", a: "Yes. Contact us and we will move your workspace to the plan that fits your team." },
  { q: "Do you offer discounts for non-profits?", a: "Yes. Reach out at info@unimisk.com with details about your organization and we'll set you up." },
  { q: "Is there a free trial of Pro?", a: "Yes. A workspace admin can start a 7-day Pro trial from this page, with no card needed. When the 7 days end, the workspace needs a Pro subscription to keep working." },
  { q: "How much is the Business plan?", a: "Business is a custom plan. Contact us with your team size and what you need and we will send you a price." },
];

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check size={16} color="#10b981" />;
  if (value === false) return <Minus size={16} color="var(--muted)" style={{ opacity: 0.5 }} />;
  return <span style={{ fontSize: 14, color: tone.fg }}>{value}</span>;
}

export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>("yearly");
  // Everything about the workspace's plan comes from the server (null for visitors and after signing out).
  const { user } = useAuth() as { user?: unknown };
  const { billing, startTrial, checkout } = useBilling() as {
    billing: null | {
      plan: PlanKey; status: "none" | "trialing" | "active" | "expired"; trialDaysLeft: number | null;
      trialEligible: boolean; canManageBilling: boolean;
    };
    startTrial: () => Promise<{ ok: boolean; error?: string }>;
    checkout: () => Promise<{ ok: boolean; error?: string }>;
  };
  const signedIn = !!(user && billing);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [showBusiness, setShowBusiness] = useState(false);

  async function onStartTrial() {
    setBusy(true); setNotice(null);
    const r = await startTrial();
    setBusy(false);
    setNotice(r.ok ? { kind: "ok", text: "Your 7-day Pro trial has started." } : { kind: "error", text: r.error || "Could not start the trial." });
  }
  async function onSubscribe() {
    setBusy(true); setNotice(null);
    const r = await checkout();
    setBusy(false);
    if (!r.ok) setNotice({ kind: "error", text: r.error || "Could not start the payment." });
  }

  /** The button on each plan card. Free never changes a plan; the trial and payment are decided by the server. */
  function planAction(p: (typeof plans)[number]) {
    const full = "w-full";
    const off = (label: string) => <Button variant="outline" type="button" disabled className={full} size="md">{label}</Button>;
    if (p.key === "free") {
      if (!signedIn) return <Button variant="outline" to="/login?mode=signup" className={full} size="md">{p.cta}</Button>;
      if (billing!.plan !== "free") return off("Included in your plan");
      return <Button variant="outline" to="/app" className={full} size="md">{p.cta}</Button>;
    }
    if (p.key === "pro") {
      if (!signedIn) return <Button variant="primary" to={p.href} className={full} size="md">{p.cta}</Button>;
      const b = billing!;
      if (b.plan === "business") return off("Included in your plan");
      if (b.status === "active") return off("Your current plan");
      if (b.status === "trialing") return off(`Trial active · ${b.trialDaysLeft ?? 0} ${b.trialDaysLeft === 1 ? "day" : "days"} left`);
      if (b.status === "expired") {
        return b.canManageBilling
          ? <Button variant="primary" type="button" onClick={onSubscribe} disabled={busy} className={full} size="md">Subscribe to Pro</Button>
          : off("Ask your admin to subscribe");
      }
      if (!b.trialEligible) return off("Trial already used");
      return b.canManageBilling
        ? <Button variant="primary" type="button" onClick={onStartTrial} disabled={busy} className={full} size="md">{p.cta}</Button>
        : off("Ask your admin to start the trial");
    }
    if (signedIn && billing!.plan === "business") return off("Your current plan");
    return <Button variant="outline" type="button" onClick={() => setShowBusiness(true)} className={full} size="md">{p.cta}</Button>;
  }

  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="Pricing"
          title={<>Simple pricing.<br />Built for every stage.</>}
          blurb="Free forever for small teams. Switch plans anytime, cancel anytime."
        />

        {/* Cycle toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
          <div
            style={{
              display: "inline-flex",
              padding: 4,
              borderRadius: 999,
              border: `1px solid ${tone.border}`,
              background: tone.card,
            }}
          >
            {(["monthly", "yearly"] as Cycle[]).map((c) => {
              const active = cycle === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  style={{
                    border: "none",
                    background: active ? tone.fg : "transparent",
                    color: active ? tone.bg : tone.muted,
                    padding: "8px 16px",
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 200ms",
                  }}
                >
                  {c[0].toUpperCase() + c.slice(1)}
                  {c === "yearly" && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 999,
                        background: active ? "rgba(16,185,129,0.20)" : "rgba(16,185,129,0.10)",
                        color: "#10b981",
                      }}
                    >
                      −17%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Plan cards */}
        <style>{".tf-plan-card{transition:transform .2s ease,box-shadow .2s ease}.tf-plan-card{border:2px solid #000 !important}.tf-plan-card a[class*='rounded'],.tf-plan-card button{border:2px solid #000 !important}:root[data-theme='dark'] .tf-plan-card a[class*='rounded'],:root[data-theme='dark'] .tf-plan-card button,:root.dark .tf-plan-card a[class*='rounded'],:root.dark .tf-plan-card button{border-color:#fff !important}.tf-plan-card:hover{transform:scale(1.03);z-index:2;box-shadow:0 28px 56px -24px rgba(139,92,246,.45)}@media (prefers-reduced-motion:reduce){.tf-plan-card{transition:none}.tf-plan-card:hover{transform:none}}"}</style>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            marginBottom: 96,
          }}
        >
          {plans.map((p) => {
            const price = cycle === "yearly" ? p.yearly : p.monthly;
            return (
              // Every card is laid out on the same five rows (name, price, button, lead-in, features) so each text lines up
              // across the three boxes. "subgrid" shares the row heights between neighbours.
              <div
                key={p.key}
                className={p.accent ? "tf-plan-card tf-plan-accent" : "tf-plan-card"}
                style={{
                  position: "relative",
                  display: "grid",
                  gridRow: "span 5",
                  gridTemplateRows: "subgrid",
                  rowGap: 0,
                  borderRadius: 16,
                  border: `1px solid ${p.accent ? `${BRAND}66` : tone.border}`,
                  background: tone.card,
                  padding: 32,
                  boxShadow: p.accent ? `0 24px 48px -24px ${BRAND}4D` : "none",
                }}
              >
                {p.accent && (
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: BRAND,
                      color: "white",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 12px",
                      borderRadius: 999,
                      letterSpacing: "-0.01em",
                      boxShadow: `0 4px 12px -4px ${BRAND}80`,
                    }}
                  >
                    Most popular
                  </div>
                )}
                <div>
                  <h3 style={{ ...display, fontSize: 22, fontWeight: 600, margin: "0 0 8px", color: tone.fg }}>
                    {p.name}
                  </h3>
                  <p style={{ fontSize: 14, color: tone.muted, lineHeight: 1.55, margin: "0 0 24px" }}>{p.pitch}</p>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 28 }}>
                  {price === null ? (
                    <span style={{ ...display, fontSize: 32, lineHeight: "58px", fontWeight: 600, color: tone.fg }}>Custom</span>
                  ) : (
                    <>
                      <span style={{ ...display, fontSize: 48, lineHeight: "58px", fontWeight: 600, color: tone.fg }}>${price}</span>
                      <span style={{ fontSize: 14, lineHeight: "58px", color: tone.muted }}>/user/mo</span>
                    </>
                  )}
                </div>
                <div style={{ marginBottom: 28 }}>
                  {planAction(p)}
                  {price === null && (
                    <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 13, lineHeight: 1.5, color: tone.muted }}>
                      <span style={{ display: "block", fontWeight: 500, color: tone.fg }}>Pricing based on your team size</span>
                      Tell us what you need and we will send a quote.
                    </p>
                  )}
                </div>
                <p aria-hidden={p.lead ? undefined : true} style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 600, color: tone.fg, margin: "0 0 12px", visibility: p.lead ? "visible" : "hidden" }}>
                  {p.lead || "\u00a0"}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12, alignContent: "start" }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: tone.fg }}>
                      <Check size={16} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {notice && (
          <p role={notice.kind === "error" ? "alert" : "status"} style={{ textAlign: "center", margin: "-72px 0 72px", fontSize: 14, color: notice.kind === "error" ? "#ef4444" : "#10b981" }}>
            {notice.text}
          </p>
        )}
        {showBusiness && <BusinessInquiryModal onClose={() => setShowBusiness(false)} />}

        {/* Comparison table */}
        <Section pad="tight" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
          <SectionHead eyebrow="Compare" title="Every feature, at a glance." />
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${tone.border}`,
              background: tone.card,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: `${tone.bg}80`, borderBottom: `1px solid ${tone.border}` }}>
                  <th style={{ textAlign: "left", padding: 16, fontWeight: 500, color: tone.muted }}>Feature</th>
                  {plans.map((p) => (
                    <th key={p.key} style={{ textAlign: "center", padding: 16, fontWeight: 600, color: tone.fg }}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, idx) => (
                  <tr
                    key={row.label}
                    style={{
                      borderBottom: idx !== comparisonRows.length - 1 ? `1px solid ${tone.border}` : "none",
                    }}
                  >
                    <td style={{ padding: 16, color: tone.fg }}>{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} style={{ padding: 16, textAlign: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <FeatureCell value={v} />
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* FAQ */}
        <Section pad="tight" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
          <SectionHead eyebrow="FAQ" title="Questions, answered." />
          <div
            style={{
              maxWidth: 760,
              margin: "0 auto",
              borderTop: `1px solid ${tone.border}`,
              borderBottom: `1px solid ${tone.border}`,
            }}
          >
            {faqs.map((f, i) => (
              <details
                key={f.q}
                style={{
                  padding: "20px 0",
                  borderBottom: i !== faqs.length - 1 ? `1px solid ${tone.border}` : "none",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    listStyle: "none",
                    fontSize: 16,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    color: tone.fg,
                  }}
                >
                  <span>{f.q}</span>
                  <span style={{ fontSize: 22, color: tone.muted, lineHeight: 1, marginLeft: 16 }}>+</span>
                </summary>
                <p style={{ marginTop: 12, color: tone.muted, lineHeight: 1.6, paddingRight: 32 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* Enterprise CTA */}
        <div
          style={{
            background: "#020617",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 24,
            padding: "48px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 32,
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 40px 80px -40px rgba(15,23,42,0.4)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 600 }}
          >
            <h2 style={{ ...display, fontSize: "clamp(26px, 3vw, 36px)", fontWeight: 600, lineHeight: 1.1, margin: 0, color: "white" }}>
              Need a plan built around your team?
            </h2>
            <p style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Tell us your team size and what you need, and we will put together a plan that fits.
            </p>
          </motion.div>
          <Button size="lg" type="button" onClick={() => setShowBusiness(true)} style={{ paddingLeft: 40, paddingRight: 40 }}>
            Contact Team Unimisk <ArrowRight style={{ marginLeft: 8, width: 16, height: 16 }} />
          </Button>
        </div>
      </Container>
    </PageShell>
  );
}
