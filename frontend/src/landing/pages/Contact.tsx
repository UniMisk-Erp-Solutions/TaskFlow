import { motion } from "motion/react";
import { Send, MapPin, Mail, MessageSquare } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export default function Contact() {
  return (
    <div className="pt-32 pb-24 px-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="space-y-12">
            <div className="space-y-5">
              <motion.h1
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                className="font-display text-4xl lg:text-5xl font-semibold tracking-[-0.03em] leading-[1.05]"
              >
                Let's talk.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 }}
                className="text-base lg:text-lg text-[var(--muted)] leading-relaxed"
              >
                Whether you have a question about features, pricing, or a professional demo,
                our team is ready to help.
              </motion.p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="size-11 bg-brand-primary/[0.10] rounded-xl flex items-center justify-center text-brand-primary shrink-0">
                  <Mail size={20} />
                </div>
                <div>
                  <h4 className="font-semibold tracking-tight">Email us</h4>
                  <p className="text-sm text-[var(--muted)] mt-0.5">hello@taskflow.app</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="size-11 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h4 className="font-semibold tracking-tight">Live support</h4>
                  <p className="text-sm text-[var(--muted)] mt-0.5">Mon–Fri, 9am – 6pm EST</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="size-11 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <h4 className="font-semibold tracking-tight">Office</h4>
                  <p className="text-sm text-[var(--muted)] mt-0.5">123 Innovation Way, San Francisco, CA 94105</p>
                </div>
              </div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="p-8 lg:p-10 border-[var(--border)]">
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium tracking-tight">First name</label>
                    <input
                      type="text"
                      placeholder="Jane"
                      className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary/40 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium tracking-tight">Last name</label>
                    <input
                      type="text"
                      placeholder="Doe"
                      className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary/40 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium tracking-tight">Work email</label>
                  <input
                    type="email"
                    placeholder="jane@company.com"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary/40 transition-all"
                  />
                </div>

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
                    rows={4}
                    placeholder="Tell us about your team's needs…"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary/40 transition-all resize-none"
                  />
                </div>

                <Button className="w-full">
                  Send message <Send className="ml-2 size-4" />
                </Button>
                <p className="text-xs text-[var(--muted)] text-center leading-relaxed">
                  By submitting, you agree to our <a href="/privacy" className="underline hover:text-brand-primary">Privacy Policy</a> and{" "}
                  <a href="/terms" className="underline hover:text-brand-primary">Terms</a>.
                </p>
              </form>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
