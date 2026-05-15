import { motion } from "motion/react";
import { Target, Heart, Eye, Rocket, Zap, Shield, Globe2, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";

const timeline = [
  { year: "2024", title: "Founded", body: "Three engineers tired of toggling between five different apps just to finish a sprint." },
  { year: "2025", title: "Beta with 30 teams", body: "We shipped the first private beta and learned what calmer execution actually looks like." },
  { year: "2025", title: "$4M seed", body: "Raised from operators-turned-investors who use the product daily." },
  { year: "2026", title: "Public launch", body: "Approval workflow, AI assistant, and the timeline you're looking at now." },
];

const values = [
  { icon: <Zap size={20} />, title: "Speed", desc: "We ship fast and help our customers do the same." },
  { icon: <Shield size={20} />, title: "Trust", desc: "Security and data integrity are non-negotiable." },
  { icon: <Heart size={20} />, title: "Clarity", desc: "Simple, honest communication in everything." },
  { icon: <Rocket size={20} />, title: "Growth", desc: "Always learning, iterating, pushing the boundary." },
];

export default function About() {
  return (
    <div className="pt-32 pb-24 px-6 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-24 space-y-5">
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-xs font-semibold tracking-[0.15em] uppercase text-brand-primary/80"
          >
            About
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl lg:text-6xl font-semibold tracking-[-0.03em] leading-[1.05]"
          >
            On a mission to kill<br />
            <span className="text-brand-primary">workflow clutter.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="text-base lg:text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed"
          >
            Teams do their best work when responsibilities are clear, deadlines are visible,
            and progress is easy to understand.
          </motion.p>
        </div>

        {/* Mission / Vision */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-28">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-9 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 size-56 bg-brand-primary/15 rounded-full blur-3xl" />
            <div className="relative space-y-4">
              <div className="size-11 rounded-xl bg-brand-primary/[0.12] text-brand-primary flex items-center justify-center">
                <Target size={22} />
              </div>
              <h3 className="text-xl font-semibold tracking-tight font-display">Our mission</h3>
              <p className="text-[var(--muted)] leading-relaxed">
                Empower every organization with a workspace that fosters accountability
                and execution speed through radical clarity.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-9 relative overflow-hidden">
            <div className="absolute -top-24 -left-24 size-56 bg-brand-accent/15 rounded-full blur-3xl" />
            <div className="relative space-y-4">
              <div className="size-11 rounded-xl bg-brand-accent/[0.12] text-brand-accent flex items-center justify-center">
                <Eye size={22} />
              </div>
              <h3 className="text-xl font-semibold tracking-tight font-display">Our vision</h3>
              <p className="text-[var(--muted)] leading-relaxed">
                Build the operating system for modern business — where every decision,
                file, and milestone is connected to the work it belongs to.
              </p>
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="mb-28">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-10 border-y border-[var(--border)]">
            {[
              { v: "40+", k: "Teammates" },
              { v: "12", k: "Countries" },
              { v: "50k+", k: "Active teams" },
              { v: "100%", k: "Remote-first" },
            ].map((s) => (
              <div key={s.k} className="text-center space-y-1.5">
                <p className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">{s.v}</p>
                <p className="text-xs text-[var(--muted)] tracking-wide uppercase">{s.k}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <section className="mb-28">
          <div className="text-center mb-12 space-y-3">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-brand-primary/80">Timeline</p>
            <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
              The short history.
            </h2>
          </div>
          <ol className="max-w-3xl mx-auto relative space-y-10 pl-12 before:content-[''] before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--border)]">
            {timeline.map((e) => (
              <li key={e.year + e.title} className="relative">
                <span className="absolute -left-12 top-0 size-10 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-[11px] font-semibold text-brand-primary tracking-tight">
                  {e.year.slice(-2)}
                </span>
                <h3 className="font-semibold tracking-tight">{e.title}</h3>
                <p className="text-sm text-[var(--muted)] mt-1.5 leading-relaxed">{e.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Values */}
        <section className="mb-28">
          <div className="text-center mb-12 space-y-3">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-brand-primary/80">Values</p>
            <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
              What we believe in.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {values.map((v) => (
              <div key={v.title} className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-brand-primary/30 transition-colors">
                <div className="size-10 rounded-lg bg-brand-primary/[0.08] text-brand-primary flex items-center justify-center mb-4">
                  {v.icon}
                </div>
                <h4 className="font-semibold tracking-tight">{v.title}</h4>
                <p className="text-sm text-[var(--muted)] mt-1.5 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Careers CTA */}
        <section>
          <div className="bg-slate-950 border border-white/10 rounded-3xl p-12 lg:p-20 text-center space-y-7 relative overflow-hidden shadow-[0_40px_80px_-40px_rgba(15,23,42,0.4)]">
            <div className="absolute -top-24 -right-24 size-96 bg-brand-primary/15 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 size-96 bg-brand-accent/15 rounded-full blur-3xl" />
            <div className="flex justify-center text-brand-primary relative z-10">
              <div className="size-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Sparkles size={22} />
              </div>
            </div>
            <h2 className="font-display text-3xl lg:text-5xl font-semibold tracking-[-0.03em] relative z-10 leading-[1.05] text-white">
              Join the journey.
            </h2>
            <p className="text-base lg:text-lg text-slate-400 max-w-2xl mx-auto relative z-10 leading-relaxed">
              Remote-first, async by default. We're hiring across engineering, design,
              and customer success.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 relative z-10">
              <span className="inline-flex items-center gap-1.5"><Globe2 size={14} /> 12 countries</span>
              <span className="inline-flex items-center gap-1.5">·</span>
              <span>4-day workweek</span>
              <span className="inline-flex items-center gap-1.5">·</span>
              <span>$5k learning budget</span>
            </div>
            <div className="flex justify-center gap-3 relative z-10">
              <Button size="lg" to="/contact">Explore careers</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
