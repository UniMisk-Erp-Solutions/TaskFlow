import { useState } from "react";
import { motion } from "motion/react";
import { Check, ArrowRight, Minus } from "lucide-react";
import { Button } from "../components/ui/Button";
import {
  PageShell, Container, Section, PageHeader, SectionHead,
  BRAND, tone, display,
} from "../lib/ui";

type Cycle = "monthly" | "yearly";

const plans = [
  {
    key: "free",
    name: "Free",
    pitch: "For solo creators or two-person teams.",
    monthly: 0,
    yearly: 0,
    cta: "Get started",
    href: "/login?mode=signup",
    accent: false,
    features: ["Up to 3 projects", "Unlimited tasks", "List & board views", "Mobile app", "Community support"],
  },
  {
    key: "pro",
    name: "Pro",
    pitch: "For teams that ship every week.",
    monthly: 12,
    yearly: 10,
    cta: "Start free trial",
    href: "/login?mode=signup",
    accent: true,
    features: ["Unlimited projects", "Calendar & timeline", "AI assistant", "Approval workflow & history", "Custom automations", "Priority support"],
  },
  {
    key: "business",
    name: "Business",
    pitch: "For organizations and regulated industries.",
    monthly: 24,
    yearly: 20,
    cta: "Contact sales",
    href: "/contact",
    accent: false,
    features: ["Everything in Pro", "Single sign-on (SSO)", "Advanced permissions", "Audit logs export", "Dedicated CSM", "99.9% SLA"],
  },
];

const comparisonRows: Array<{ label: string; values: [string | boolean, string | boolean, string | boolean] }> = [
  { label: "Projects", values: ["3", "Unlimited", "Unlimited"] },
  { label: "Members", values: ["5", "Unlimited", "Unlimited"] },
  { label: "List & board", values: [true, true, true] },
  { label: "Calendar & timeline", values: [false, true, true] },
  { label: "AI assistant", values: [false, true, true] },
  { label: "Approval workflow", values: [false, true, true] },
  { label: "Audit logs", values: [false, "30 days", "Unlimited"] },
  { label: "SSO & SCIM", values: [false, false, true] },
  { label: "Priority support", values: [false, true, true] },
  { label: "Dedicated CSM", values: [false, false, true] },
];

const faqs = [
  { q: "Can I switch plans anytime?", a: "Yes — upgrade or downgrade whenever it suits your team. Pro-rated billing applies on annual plans." },
  { q: "Do you offer discounts for non-profits?", a: "Yes. Reach out at hello@taskflow.app with details about your organization and we'll set you up." },
  { q: "Is there a free trial of Pro?", a: "Every workspace gets a 14-day Pro trial automatically when you create an account. No credit card required." },
  { q: "How is data backed up?", a: "Encrypted backups run hourly across two regions. We retain 30 days of point-in-time recovery." },
];

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check size={16} color="#10b981" />;
  if (value === false) return <Minus size={16} color="var(--muted)" style={{ opacity: 0.5 }} />;
  return <span style={{ fontSize: 14, color: tone.fg }}>{value}</span>;
}

export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>("yearly");

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
              <div
                key={p.key}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
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
                <h3 style={{ ...display, fontSize: 22, fontWeight: 600, margin: "0 0 8px", color: tone.fg }}>
                  {p.name}
                </h3>
                <p style={{ fontSize: 14, color: tone.muted, lineHeight: 1.55, margin: "0 0 24px" }}>{p.pitch}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 28 }}>
                  <span style={{ ...display, fontSize: 48, fontWeight: 600, color: tone.fg }}>${price}</span>
                  <span style={{ fontSize: 14, color: tone.muted }}>/user/mo</span>
                </div>
                <div style={{ marginBottom: 28 }}>
                  <Button variant={p.accent ? "primary" : "outline"} to={p.href} className="w-full" size="md">
                    {p.cta}
                  </Button>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "auto 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
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
              Need an Enterprise plan?
            </h2>
            <p style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Custom limits, dedicated support, white-glove onboarding, and procurement docs.
            </p>
          </motion.div>
          <Button size="lg" to="/contact">
            Schedule a demo <ArrowRight style={{ marginLeft: 8, width: 16, height: 16 }} />
          </Button>
        </div>
      </Container>
    </PageShell>
  );
}
