import { motion } from "motion/react";
import {
  ArrowRight, Zap, Shield, Users, BarChart3, Clock, Sparkles,
  CheckCircle2, Layers, Calendar, MessageSquare, Star,
} from "lucide-react";
import { Button } from "../components/ui/Button";

/**
 * Decorative grid backdrop — a soft dotted grid that gives the hero some
 * "studio" depth without dominating the layout. Uses CSS background-image
 * so it never hits the bundle.
 */
function GridBackdrop() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 -z-10 [mask-image:radial-gradient(closest-side_at_center,black_55%,transparent_100%)]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.10) 1px, transparent 0)",
        backgroundSize: "24px 24px",
      }}
    />
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-primary/[0.08] text-brand-primary text-xs font-medium border border-brand-primary/15 tracking-tight">
      <span className="size-1.5 rounded-full bg-brand-primary animate-pulse" />
      {children}
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  blurb,
}: {
  eyebrow: string;
  title: React.ReactNode;
  blurb?: string;
}) {
  return (
    <div className="text-center mb-16 max-w-3xl mx-auto space-y-4">
      <p className="text-xs font-semibold tracking-[0.15em] uppercase text-brand-primary/80">{eyebrow}</p>
      <h2 className="font-display text-3xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.05]">
        {title}
      </h2>
      {blurb && (
        <p className="text-base lg:text-lg text-[var(--muted)] leading-relaxed">{blurb}</p>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col w-full font-sans">
      {/* ─── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-24 px-6 overflow-hidden">
        <GridBackdrop />
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 size-[720px] bg-brand-primary/[0.12] rounded-full blur-[140px]" />
          <div className="absolute top-44 left-1/4 size-[420px] bg-brand-accent/[0.10] rounded-full blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Eyebrow>New · AI workflow automation</Eyebrow>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="font-display text-[44px] sm:text-6xl lg:text-7xl font-semibold tracking-[-0.035em] leading-[1.02] mt-8 mb-6 text-balance text-[var(--foreground)]"
          >
            The execution workspace<br />
            <span className="bg-gradient-to-r from-brand-primary via-brand-accent to-brand-primary bg-clip-text text-transparent">
              for teams that move fast.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="text-base lg:text-xl text-[var(--muted)] max-w-2xl mx-auto mb-10 text-pretty leading-relaxed"
          >
            Plan, assign, and ship work without the friction. One calm workspace
            for tasks, meetings, and the people who get them done.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button size="lg" to="/login?mode=signup" className="w-full sm:w-auto min-w-[200px]">
              Start free <ArrowRight className="ml-2 size-4" />
            </Button>
            <Button variant="outline" size="lg" to="/features" className="w-full sm:w-auto min-w-[200px]">
              See how it works
            </Button>
          </motion.div>

          <div className="mt-7 flex items-center justify-center gap-6 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-500" /> No credit card</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-500" /> 14-day Pro trial</span>
            <span className="hidden sm:inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-500" /> Cancel anytime</span>
          </div>
        </div>

        {/* Mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 28 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25 }}
          className="max-w-6xl mx-auto mt-20 relative"
        >
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 h-9 border-b border-[var(--border)] bg-[var(--background)]/60">
              <span className="size-2.5 rounded-full bg-red-400/70" />
              <span className="size-2.5 rounded-full bg-amber-400/70" />
              <span className="size-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-3 text-[11px] text-[var(--muted)] tracking-tight">app.taskflow.io / projects</span>
            </div>

            <div className="flex min-h-[460px]">
              <div className="w-14 border-r border-[var(--border)] bg-[var(--background)]/40 flex flex-col items-center py-5 gap-4 shrink-0">
                <div className="size-7 rounded-lg bg-brand-primary shadow-[0_4px_12px_-2px_rgba(139,92,246,0.5)]" />
                <div className="size-7 rounded-lg bg-[var(--accent)]" />
                <div className="size-7 rounded-lg bg-[var(--accent)]" />
                <div className="size-7 rounded-lg bg-[var(--accent)]" />
              </div>

              <div className="flex-1 flex flex-col">
                <div className="h-12 border-b border-[var(--border)] flex items-center px-6 justify-between bg-[var(--background)]/40">
                  <div className="flex items-center gap-3">
                    <p className="font-semibold tracking-tight text-sm">Marketing Sprint · Q3</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/[0.12] text-emerald-600 font-medium">On track</span>
                  </div>
                  <div className="flex -space-x-1.5">
                    <div className="size-6 rounded-full bg-brand-primary/30 border-2 border-[var(--card)]" />
                    <div className="size-6 rounded-full bg-emerald-400/30 border-2 border-[var(--card)]" />
                    <div className="size-6 rounded-full bg-amber-400/30 border-2 border-[var(--card)]" />
                  </div>
                </div>

                <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {[
                    { title: "Backlog", color: "bg-slate-400", items: ["Update brand guidelines", "Audit landing copy"] },
                    { title: "In Progress", color: "bg-brand-primary", items: ["Launch announcement", "API documentation refresh"] },
                    { title: "Done", color: "bg-emerald-500", items: ["Q2 retrospective", "Onboarding videos"] },
                  ].map((col) => (
                    <div key={col.title} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${col.color}`} />
                        <p className="text-[11px] font-semibold tracking-wide uppercase text-[var(--muted)]">{col.title}</p>
                      </div>
                      {col.items.map((t) => (
                        <div key={t} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 space-y-2">
                          <p className="text-xs font-medium leading-snug text-[var(--foreground)]">{t}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--muted)]">Due Aug 24</span>
                            <div className="size-4 rounded-full bg-brand-primary/30" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating stat card */}
          <div className="absolute -bottom-6 right-8 p-4 bg-[var(--card)] rounded-2xl shadow-[0_20px_40px_-16px_rgba(15,23,42,0.20)] border border-[var(--border)] hidden md:flex items-center gap-3 w-56">
            <div className="size-9 rounded-xl bg-emerald-500/[0.12] text-emerald-600 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-[11px] text-[var(--muted)] tracking-tight">This week</p>
              <p className="text-base font-semibold tracking-tight">+38 tasks shipped</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── LOGOS ─────────────────────────────────────────────────────── */}
      <section className="py-12 border-y border-[var(--border)] bg-[var(--background)]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-8">
          <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-[var(--muted)]">Trusted by teams at</p>
          <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-5 text-base font-semibold text-[var(--muted)]/70 tracking-tight">
            <span>LAYER</span><span>QUARTZ</span><span>NOTION</span><span>VELOCITY</span><span>FORGE</span><span>ATLAS</span>
          </div>
        </div>
      </section>

      {/* ─── BENTO FEATURES ───────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-[var(--background)]">
        <div className="max-w-6xl mx-auto">
          <SectionHead
            eyebrow="What's inside"
            title={<>Everything teams need.<br /><span className="text-[var(--muted)]">Nothing they don't.</span></>}
            blurb="Calm, focused, and built on real workflow primitives — not feature checklists."
          />

          <div className="grid grid-cols-1 md:grid-cols-6 gap-5 auto-rows-[180px]">
            {/* Big tile */}
            <div className="md:col-span-4 md:row-span-2 group rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 relative overflow-hidden flex flex-col justify-end hover:border-brand-primary/30 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/[0.10] via-transparent to-transparent" />
              <div className="absolute top-8 right-8 size-32 rounded-full bg-brand-primary/15 blur-2xl" />
              <div className="relative">
                <div className="size-11 rounded-xl bg-brand-primary/[0.10] text-brand-primary flex items-center justify-center mb-5">
                  <Layers size={22} />
                </div>
                <h3 className="font-display text-2xl font-semibold tracking-tight mb-2">Tasks, subtasks & meetings — one model</h3>
                <p className="text-[var(--muted)] text-sm leading-relaxed max-w-md">
                  Nested work, multi-assignees, real-time updates, history timeline. The
                  primitives every team actually uses, finally working together.
                </p>
              </div>
            </div>

            <div className="md:col-span-2 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 hover:border-brand-primary/30 transition-colors">
              <div className="size-10 rounded-lg bg-emerald-500/[0.10] text-emerald-600 flex items-center justify-center mb-4">
                <Shield size={20} />
              </div>
              <h3 className="font-semibold tracking-tight mb-1">Enterprise security</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">SOC2 · GDPR · RLS-isolated workspaces.</p>
            </div>

            <div className="md:col-span-2 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 hover:border-brand-primary/30 transition-colors">
              <div className="size-10 rounded-lg bg-amber-500/[0.10] text-amber-600 flex items-center justify-center mb-4">
                <Sparkles size={20} />
              </div>
              <h3 className="font-semibold tracking-tight mb-1">AI assistant</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">Summaries, smart scheduling, and replies.</p>
            </div>

            <div className="md:col-span-3 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-7 hover:border-brand-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-brand-accent/[0.12] text-brand-accent flex items-center justify-center"><Calendar size={20} /></div>
                <h3 className="font-semibold tracking-tight">Calendar & timeline views</h3>
              </div>
              <p className="text-sm text-[var(--muted)] leading-relaxed">See what's due, who's free, and what's blocking. Same data, the view your team needs.</p>
            </div>

            <div className="md:col-span-3 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-7 hover:border-brand-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-brand-primary/[0.10] text-brand-primary flex items-center justify-center"><BarChart3 size={20} /></div>
                <h3 className="font-semibold tracking-tight">Reports that actually help</h3>
              </div>
              <p className="text-sm text-[var(--muted)] leading-relaxed">Workload, completion rate, delay tracking — designed for review, not vanity.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── WORKFLOW ─────────────────────────────────────────────────── */}
      <section className="py-28 px-6 border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto">
          <SectionHead
            eyebrow="How it works"
            title={<>From scattered to shipped<br />in three calm steps.</>}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n: "01", icon: <Users size={22} />, title: "Bring the team in", desc: "Invite teammates, set roles, and group work into projects in under a minute." },
              { n: "02", icon: <Zap size={22} />, title: "Plan & assign", desc: "Break work into tasks, set priorities and dependencies. Drag, schedule, repeat." },
              { n: "03", icon: <CheckCircle2 size={22} />, title: "Submit & approve", desc: "Employees submit for review with notes. Admins approve or reopen — all logged." },
            ].map((s) => (
              <div key={s.n} className="relative p-7 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-brand-primary/30 transition-colors">
                <div className="flex items-center justify-between mb-5">
                  <span className="font-display text-sm font-semibold text-brand-primary tracking-[0.1em]">{s.n}</span>
                  <div className="size-10 rounded-lg bg-brand-primary/[0.10] text-brand-primary flex items-center justify-center">{s.icon}</div>
                </div>
                <h3 className="font-semibold tracking-tight text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIAL ──────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[var(--background)]">
        <div className="max-w-4xl mx-auto">
          <figure className="text-center space-y-7">
            <div className="flex justify-center gap-1 text-amber-400">
              {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={16} fill="currentColor" strokeWidth={0} />)}
            </div>
            <blockquote className="font-display text-2xl lg:text-3xl font-medium tracking-tight leading-snug text-balance">
              "We replaced three tools with Taskflow. The submit-and-approve flow alone
              saves our leads half a day a week — and our team finally stopped
              asking 'where do we track this again?'"
            </blockquote>
            <figcaption className="flex items-center justify-center gap-3 pt-2">
              <div className="size-10 rounded-full bg-brand-primary/20" />
              <div className="text-left">
                <p className="text-sm font-semibold tracking-tight">Maya Patel</p>
                <p className="text-xs text-[var(--muted)]">Head of Operations · Quartz</p>
              </div>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ─── STATS ────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.18),transparent_60%),radial-gradient(circle_at_70%_50%,rgba(192,132,252,0.14),transparent_60%)]" />
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 relative z-10">
          {[
            { value: "98%", label: "Satisfaction" },
            { value: "1.2M+", label: "Tasks monthly" },
            { value: "50k+", label: "Teams" },
            { value: "<2s", label: "Median load time" },
          ].map((s) => (
            <div key={s.label} className="text-center space-y-2">
              <p className="font-display text-4xl lg:text-5xl font-semibold tracking-[-0.025em]">{s.value}</p>
              <p className="text-slate-400 text-xs tracking-wide uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[var(--background)]">
        <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-3xl p-12 lg:p-20 text-center relative overflow-hidden shadow-[0_40px_80px_-40px_rgba(15,23,42,0.4)]">
          <div className="absolute -top-24 -left-24 size-96 bg-brand-primary/25 rounded-full blur-3xl opacity-60" />
          <div className="absolute -bottom-24 -right-24 size-96 bg-brand-accent/25 rounded-full blur-3xl opacity-60" />

          <div className="relative z-10 space-y-5">
            <h2 className="font-display text-4xl lg:text-6xl font-semibold tracking-[-0.03em] leading-[1.05] text-white">
              Bring calm to your team's work.
            </h2>
            <p className="text-base lg:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
              Free forever for small teams. No credit card required to start.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative z-10 mt-8">
            <Button size="lg" to="/login?mode=signup" className="w-full sm:w-auto min-w-[200px]">
              Get started free
            </Button>
            <Button variant="outline" size="lg" to="/contact" className="w-full sm:w-auto min-w-[200px] border-white/20 text-white hover:bg-white/10">
              <MessageSquare className="mr-2 size-4" /> Talk to sales
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
