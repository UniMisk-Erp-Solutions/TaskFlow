import { motion } from "motion/react";
import {
  ArrowRight, Zap, Shield, Users, BarChart3, Clock, Sparkles,
  CheckCircle2, Layers, Calendar, MessageSquare, Star,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { PageShell, Container, Section, SectionHead, CtaPanel } from "../components/ui/Section";

const features = [
  { icon: <Zap size={20} />, title: "Real-time sync", desc: "Collaborate with your team in real-time with instant updates across every device." },
  { icon: <Users size={20} />, title: "Team management", desc: "Manage roles, permissions, and workload distribution with intuitive controls." },
  { icon: <Shield size={20} />, title: "Enterprise security", desc: "Bank-grade encryption and advanced security protocols protect your data." },
  { icon: <BarChart3 size={20} />, title: "Advanced reports", desc: "Deep insight into productivity, completion rates, and project health." },
  { icon: <Clock size={20} />, title: "Timeline view", desc: "Plan projects with visual timelines and manage dependencies effortlessly." },
  { icon: <Sparkles size={20} />, title: "AI automation", desc: "Let our AI handle repetitive tasks, summaries, and smart scheduling." },
];

const steps = [
  { n: "01", icon: <Users size={20} />, title: "Bring the team in", desc: "Invite teammates, set roles, and group work into projects in under a minute." },
  { n: "02", icon: <Zap size={20} />, title: "Plan & assign", desc: "Break work into tasks, set priorities and dependencies. Drag, schedule, repeat." },
  { n: "03", icon: <CheckCircle2 size={20} />, title: "Submit & approve", desc: "Employees submit for review with notes. Admins approve or reopen — all logged." },
];

export default function Home() {
  return (
    <div className="font-sans">
      {/* ─── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[var(--background)]">
        {/* Soft brand-tinted glow */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[640px] -z-10 opacity-60 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0) 70%)",
          }}
        />
        <Container width="6xl" className="pt-32 lg:pt-40 pb-16 lg:pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-primary/20 bg-brand-primary/10 text-brand-primary text-xs font-medium tracking-tight"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-primary" />
            New · AI workflow automation
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold tracking-tight leading-tight mt-8 mb-6 text-[var(--foreground)]"
          >
            The execution workspace<br />
            <span className="text-brand-primary">for teams that move fast.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-base lg:text-lg text-[var(--muted)] max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Plan, assign, and ship work without the friction. One calm workspace
            for tasks, meetings, and the people who get them done.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button size="lg" to="/login?mode=signup" className="w-full sm:w-auto sm:min-w-[200px]">
              Start free <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button variant="outline" size="lg" to="/features" className="w-full sm:w-auto sm:min-w-[200px]">
              See how it works
            </Button>
          </motion.div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> No credit card</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 14-day Pro trial</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Cancel anytime</span>
          </div>

          {/* Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7 }}
            className="mt-16 lg:mt-20"
          >
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden text-left">
              <div className="flex items-center gap-2 px-4 h-9 border-b border-[var(--border)] bg-[var(--background)]/60">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-3 text-[11px] text-[var(--muted)]">app.taskflow.io / projects</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
                {[
                  { title: "Backlog", dot: "bg-slate-400", items: ["Update brand guidelines", "Audit landing copy"] },
                  { title: "In Progress", dot: "bg-brand-primary", items: ["Launch announcement", "API documentation refresh"] },
                  { title: "Done", dot: "bg-emerald-500", items: ["Q2 retrospective", "Onboarding videos"] },
                ].map((col) => (
                  <div key={col.title} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <p className="text-[11px] font-semibold tracking-wide uppercase text-[var(--muted)]">{col.title}</p>
                    </div>
                    {col.items.map((t) => (
                      <div key={t} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/60">
                        <p className="text-xs font-medium leading-snug text-[var(--foreground)]">{t}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-[var(--muted)]">Due Aug 24</span>
                          <div className="w-4 h-4 rounded-full bg-brand-primary/30" />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* ─── LOGOS ─────────────────────────────────────────────────────── */}
      <section className="border-y border-[var(--border)] bg-[var(--background)]">
        <Container width="6xl" className="py-12">
          <div className="flex flex-col items-center gap-6">
            <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-[var(--muted)]">
              Trusted by teams at
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-base font-semibold tracking-tight text-[var(--muted)] opacity-70">
              <span>LAYER</span>
              <span>QUARTZ</span>
              <span>NOTION</span>
              <span>VELOCITY</span>
              <span>FORGE</span>
              <span>ATLAS</span>
            </div>
          </div>
        </Container>
      </section>

      {/* ─── FEATURES (simple, robust 3-col grid) ─────────────────────── */}
      <Section className="bg-[var(--background)]">
        <Container width="6xl">
          <SectionHead
            eyebrow="What's inside"
            title={<>Everything teams need.<br /><span className="text-[var(--muted)]">Nothing they don't.</span></>}
            blurb="Calm, focused, and built on real workflow primitives — not feature checklists."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-7 hover:border-brand-primary/40 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-5">
                  {f.icon}
                </div>
                <h3 className="font-semibold tracking-tight text-lg mb-2 text-[var(--foreground)]">{f.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--muted)]">{f.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* ─── WORKFLOW STEPS ───────────────────────────────────────────── */}
      <Section className="border-t border-[var(--border)] bg-[var(--background)]">
        <Container width="6xl">
          <SectionHead
            eyebrow="How it works"
            title={<>From scattered to shipped<br />in three calm steps.</>}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {steps.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-7 hover:border-brand-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="font-display text-sm font-semibold text-brand-primary tracking-widest">{s.n}</span>
                  <div className="w-10 h-10 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                    {s.icon}
                  </div>
                </div>
                <h3 className="font-semibold tracking-tight text-lg mb-2 text-[var(--foreground)]">{s.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--muted)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* ─── TESTIMONIAL ──────────────────────────────────────────────── */}
      <Section className="bg-[var(--background)]">
        <Container width="5xl">
          <figure className="text-center space-y-6">
            <div className="flex justify-center gap-1 text-amber-400">
              {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-4 h-4" fill="currentColor" strokeWidth={0} />)}
            </div>
            <blockquote className="font-display text-2xl lg:text-3xl font-medium tracking-tight leading-snug text-[var(--foreground)]">
              "We replaced three tools with Taskflow. The submit-and-approve flow
              alone saves our leads half a day a week — and our team finally stopped
              asking 'where do we track this again?'"
            </blockquote>
            <figcaption className="flex items-center justify-center gap-3 pt-2">
              <div className="w-10 h-10 rounded-full bg-brand-primary/20" />
              <div className="text-left">
                <p className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Maya Patel</p>
                <p className="text-xs text-[var(--muted)]">Head of Operations · Quartz</p>
              </div>
            </figcaption>
          </figure>
        </Container>
      </Section>

      {/* ─── STATS ────────────────────────────────────────────────────── */}
      <section className="relative bg-slate-950 text-white py-20 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
            {[
              { v: "98%", l: "Satisfaction" },
              { v: "1.2M+", l: "Tasks monthly" },
              { v: "50k+", l: "Teams" },
              { v: "<2s", l: "Median load time" },
            ].map((s) => (
              <div key={s.l} className="space-y-2">
                <p className="font-display text-4xl lg:text-5xl font-semibold tracking-tight">{s.v}</p>
                <p className="text-slate-400 text-xs tracking-wide uppercase">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────── */}
      <Section className="bg-[var(--background)]">
        <Container width="5xl">
          <CtaPanel
            title="Bring calm to your team's work."
            blurb="Free forever for small teams. No credit card required to start."
          >
            <Button size="lg" to="/login?mode=signup" className="w-full sm:w-auto sm:min-w-[200px]">
              Get started free
            </Button>
            <Button
              variant="outline"
              size="lg"
              to="/contact"
              className="w-full sm:w-auto sm:min-w-[200px] border-white/20 text-white hover:bg-white/10"
            >
              <MessageSquare className="mr-2 w-4 h-4" /> Talk to sales
            </Button>
          </CtaPanel>
        </Container>
      </Section>
    </div>
  );
}
