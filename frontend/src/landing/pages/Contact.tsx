import { motion } from "motion/react";
import { Send, MapPin, Mail, MessageSquare, Clock } from "lucide-react";
import { Button } from "../components/ui/Button";
import { PageShell, Container, PageHeader, Eyebrow } from "../components/ui/Section";

const contacts = [
  { icon: <Mail size={18} />, label: "Email us", value: "hello@taskflow.app", accent: "brand" },
  { icon: <MessageSquare size={18} />, label: "Live support", value: "Mon–Fri · 9am – 6pm EST", accent: "emerald" },
  { icon: <Clock size={18} />, label: "Response time", value: "Under 4 business hours", accent: "amber" },
  { icon: <MapPin size={18} />, label: "Office", value: "123 Innovation Way, SF, CA 94105", accent: "rose" },
];

const accentClass = (k: string) =>
  k === "emerald" ? "bg-emerald-500/[0.10] text-emerald-600"
  : k === "amber" ? "bg-amber-500/[0.10] text-amber-600"
  : k === "rose" ? "bg-rose-500/[0.10] text-rose-600"
  : "bg-brand-primary/[0.10] text-brand-primary";

export default function Contact() {
  return (
    <PageShell>
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16 items-start">
          {/* Left — copy + contact cards */}
          <div className="lg:col-span-2 space-y-10">
            <div className="space-y-5">
              <Eyebrow>Contact</Eyebrow>
              <motion.h1
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="font-display text-4xl lg:text-5xl font-semibold tracking-[-0.03em] leading-[1.05]"
              >
                Let's talk.
              </motion.h1>
              <p className="text-base text-[var(--muted)] leading-relaxed">
                Whether you have a question about features, pricing, or a professional
                demo, our team is ready to help.
              </p>
            </div>

            <div className="space-y-3">
              {contacts.map((c) => (
                <div
                  key={c.label}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)]"
                >
                  <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${accentClass(c.accent)}`}>
                    {c.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--muted)] tracking-tight">{c.label}</p>
                    <p className="text-sm font-medium tracking-tight truncate">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-3"
          >
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 lg:p-10 shadow-[0_24px_48px_-24px_rgba(15,23,42,0.12)]">
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="First name" placeholder="Jane" />
                  <Field label="Last name" placeholder="Doe" />
                </div>
                <Field label="Work email" placeholder="jane@company.com" type="email" />

                <div className="space-y-1.5">
                  <label className="text-sm font-medium tracking-tight">Company size</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary/40 transition-all">
                    <option>1–10 employees</option>
                    <option>11–50 employees</option>
                    <option>51–200 employees</option>
                    <option>201–1,000 employees</option>
                    <option>1,000+ employees</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium tracking-tight">Message</label>
                  <textarea
                    rows={5}
                    placeholder="Tell us about your team's needs…"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary/40 transition-all resize-none"
                  />
                </div>

                <Button className="w-full">
                  Send message <Send className="ml-2 size-4" />
                </Button>
                <p className="text-xs text-[var(--muted)] text-center leading-relaxed">
                  By submitting, you agree to our{" "}
                  <a href="/privacy" className="underline hover:text-brand-primary">Privacy Policy</a> and{" "}
                  <a href="/terms" className="underline hover:text-brand-primary">Terms</a>.
                </p>
              </form>
            </div>
          </motion.div>
        </div>
      </Container>
    </PageShell>
  );
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium tracking-tight">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary/40 transition-all"
      />
    </div>
  );
}
