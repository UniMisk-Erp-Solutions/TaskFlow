import { useState } from "react";
import { motion } from "motion/react";
import { Check, ArrowRight, Minus } from "lucide-react";
import { Button } from "../components/ui/Button";

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
    features: [
      "Up to 3 projects",
      "Unlimited tasks",
      "List & board views",
      "Mobile app",
      "Community support",
    ],
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
    features: [
      "Unlimited projects",
      "Calendar & timeline",
      "AI assistant",
      "Approval workflow & history",
      "Custom automations",
      "Priority support",
    ],
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
    features: [
      "Everything in Pro",
      "Single sign-on (SSO)",
      "Advanced permissions",
      "Audit logs export",
      "Dedicated CSM",
      "99.9% SLA",
    ],
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
  if (value === true) return <Check size={16} className="text-emerald-500" />;
  if (value === false) return <Minus size={16} className="text-[var(--muted)]/50" />;
  return <span className="text-sm text-[var(--foreground)]">{value}</span>;
}

export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>("yearly");

  return (
    <div className="pt-32 pb-24 px-6 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <motion.p
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="text-xs font-semibold tracking-[0.15em] uppercase text-brand-primary/80"
          >
            Pricing
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="font-display text-4xl lg:text-6xl font-semibold tracking-[-0.03em] leading-[1.05]"
          >
            Simple pricing.<br />Built for every stage.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-base lg:text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed"
          >
            Free forever for small teams. Switch plans anytime, cancel anytime.
          </motion.p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex p-1 rounded-full border border-[var(--border)] bg-[var(--card)]">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium tracking-tight transition-all ${cycle === "monthly" ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)]"}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle("yearly")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium tracking-tight transition-all flex items-center gap-2 ${cycle === "yearly" ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)]"}`}
            >
              Yearly
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cycle === "yearly" ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-500/10 text-emerald-600"}`}>−17%</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-24">
          {plans.map((p) => {
            const price = cycle === "yearly" ? p.yearly : p.monthly;
            return (
              <div
                key={p.key}
                className={`relative rounded-2xl border bg-[var(--card)] p-7 flex flex-col transition-all ${p.accent ? "border-brand-primary/40 shadow-[0_24px_48px_-24px_rgba(139,92,246,0.30)]" : "border-[var(--border)] hover:border-brand-primary/30"}`}
              >
                {p.accent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand-primary text-white text-[11px] font-semibold tracking-tight shadow-[0_4px_12px_-4px_rgba(139,92,246,0.5)]">
                    Most popular
                  </div>
                )}
                <h3 className="font-display text-xl font-semibold tracking-tight">{p.name}</h3>
                <p className="text-sm text-[var(--muted)] mt-2 mb-6 leading-relaxed">{p.pitch}</p>
                <div className="flex items-baseline gap-1 mb-7">
                  <span className="font-display text-5xl font-semibold tracking-[-0.025em]">${price}</span>
                  <span className="text-[var(--muted)] text-sm">/user/mo</span>
                </div>
                <Button variant={p.accent ? "primary" : "outline"} to={p.href} className="w-full mb-7">
                  {p.cta}
                </Button>
                <ul className="space-y-3 mt-auto">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Comparison table */}
        <section className="mb-24">
          <div className="text-center mb-10 space-y-3">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-brand-primary/80">Compare</p>
            <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
              Every feature, at a glance.
            </h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--background)]/40 border-b border-[var(--border)]">
                  <th className="text-left p-4 font-medium tracking-tight text-[var(--muted)]">Feature</th>
                  {plans.map((p) => (
                    <th key={p.key} className="text-center p-4 font-semibold tracking-tight">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, idx) => (
                  <tr key={row.label} className={idx !== comparisonRows.length - 1 ? "border-b border-[var(--border)]" : ""}>
                    <td className="p-4 text-[var(--foreground)]">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="p-4 text-center"><FeatureCell value={v} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-20">
          <div className="text-center mb-10 space-y-3">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-brand-primary/80">FAQ</p>
            <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
              Questions, answered.
            </h2>
          </div>
          <div className="max-w-3xl mx-auto divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="font-medium text-base tracking-tight">{f.q}</span>
                  <span className="text-[var(--muted)] text-xl leading-none group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-[var(--muted)] leading-relaxed mt-3 pr-8">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Enterprise CTA */}
        <section>
          <div className="bg-slate-950 border border-white/10 rounded-3xl p-10 lg:p-14 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-[0_40px_80px_-40px_rgba(15,23,42,0.4)]">
            <div className="space-y-3 text-center lg:text-left max-w-xl">
              <h2 className="font-display text-2xl lg:text-3xl font-semibold tracking-[-0.025em] text-white">
                Need an Enterprise plan?
              </h2>
              <p className="text-base text-slate-400 leading-relaxed">
                Custom limits, dedicated support, white-glove onboarding, and procurement docs.
              </p>
            </div>
            <Button size="lg" to="/contact" className="whitespace-nowrap">
              Schedule a demo <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
