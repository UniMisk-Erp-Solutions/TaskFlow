import { motion } from "motion/react";
import { ArrowRight, Zap, Shield, Users, BarChart3, Clock, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { cn } from "@/src/lib/utils";

export default function Home() {
  const features = [
    { icon: <Zap size={22} />, title: "Real-time sync", description: "Collaborate with your team in real-time with instant updates across every device." },
    { icon: <Users size={22} />, title: "Team management", description: "Manage roles, permissions, and workload distribution with intuitive controls." },
    { icon: <Shield size={22} />, title: "Enterprise security", description: "Bank-grade encryption and advanced security protocols protect your data." },
    { icon: <BarChart3 size={22} />, title: "Advanced reports", description: "Deep insight into productivity, completion rates, and project health." },
    { icon: <Clock size={22} />, title: "Timeline view", description: "Plan projects with visual timelines and manage dependencies effortlessly." },
    { icon: <Sparkles size={22} />, title: "AI automation", description: "Let our AI handle repetitive tasks, summaries, and smart scheduling." },
  ];

  return (
    <div className="flex flex-col w-full font-sans">
      {/* Hero */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 size-[640px] bg-brand-primary/10 rounded-full blur-[140px]" />
          <div className="absolute top-44 left-1/3 size-[500px] bg-brand-accent/[0.06] rounded-full blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-primary/[0.08] text-brand-primary text-xs font-medium mb-8 border border-brand-primary/15"
          >
            <span className="size-1.5 rounded-full bg-brand-primary animate-pulse" />
            New · AI workflow automation
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-[-0.035em] leading-[1.04] mb-6 text-balance text-[var(--foreground)]"
          >
            Project clarity for teams<br />
            that <span className="text-brand-primary">move fast.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="text-lg lg:text-xl text-[var(--muted)] max-w-2xl mx-auto mb-10 text-pretty leading-relaxed"
          >
            Turn scattered tasks into organized execution. Manage your team, track progress,
            and hit deadlines — all in one calm, powerful workspace.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button size="lg" to="/login?mode=signup" className="w-full sm:w-auto min-w-[180px]">
              Get started free <ArrowRight className="ml-2 size-4" />
            </Button>
            <Button variant="outline" size="lg" to="/features" className="w-full sm:w-auto min-w-[180px]">
              Explore features
            </Button>
          </motion.div>
          <p className="mt-5 text-xs text-[var(--muted)]">No credit card required · Cancel anytime</p>
        </div>

        {/* Dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 32 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25 }}
          className="max-w-6xl mx-auto mt-20 relative px-2"
        >
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_24px_64px_-24px_rgba(15,23,42,0.18)] overflow-hidden flex min-h-[480px]">
            <div className="w-14 bg-slate-950 dark:bg-black border-r border-slate-800 flex flex-col items-center py-7 gap-5 shrink-0">
              <div className="size-7 rounded-lg bg-brand-primary shadow-[0_4px_12px_-2px_rgba(139,92,246,0.5)]" />
              <div className="size-7 rounded-lg bg-slate-800/80" />
              <div className="size-7 rounded-lg bg-slate-800/80" />
              <div className="size-7 rounded-lg bg-slate-800/80" />
            </div>
            <div className="flex-1 flex flex-col bg-slate-950">
              <div className="h-14 border-b border-white/10 flex items-center px-7 justify-between bg-white/5 backdrop-blur-sm">
                <p className="font-semibold text-white text-sm tracking-tight">Team Dashboard</p>
                <div className="flex gap-2">
                  <div className="size-7 rounded-full bg-brand-primary/25 border border-brand-primary/30" />
                  <div className="size-7 rounded-full bg-slate-800" />
                </div>
              </div>
              <div className="flex-1 p-7 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-7">
                  <div className="p-5 rounded-xl bg-white/[0.04] border border-white/10">
                    <p className="text-[11px] text-brand-primary mb-1.5 font-medium tracking-wide uppercase">Productivity</p>
                    <p className="text-3xl font-semibold text-white tracking-tight">94.2%</p>
                    <div className="h-1 w-full bg-white/10 rounded-full mt-4 overflow-hidden">
                      <div className="h-full bg-brand-primary w-[72%]" />
                    </div>
                  </div>
                  <div className="p-5 rounded-xl bg-white/[0.04] border border-white/10">
                    <p className="text-[11px] text-brand-primary mb-1.5 font-medium tracking-wide uppercase">Active sprints</p>
                    <p className="text-3xl font-semibold text-white tracking-tight">12</p>
                    <p className="text-xs text-emerald-400 mt-2 font-medium">3 closing today</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide mb-4">Upcoming tasks</p>
                  {[
                    { title: "Review Q3 Marketing Deck", status: "High" },
                    { title: "Update API Documentation", status: "Done" },
                    { title: "Sync with Engineering Lead", status: "Medium" }
                  ].map((task, i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
                      <div className={cn("size-4 rounded border-2 border-white/20", i === 1 && "bg-brand-primary border-brand-primary")} />
                      <p className={cn("text-sm flex-1 text-white/90", i === 1 && "line-through opacity-30")}>{task.title}</p>
                      <span className="px-2.5 py-0.5 bg-brand-primary/10 border border-brand-primary/20 rounded-full text-[10px] font-medium text-brand-primary">{task.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-8 right-8 p-5 bg-[var(--card)] rounded-xl shadow-[0_20px_40px_-16px_rgba(15,23,42,0.18)] border border-[var(--border)] hidden lg:block w-48">
            <p className="text-xs font-semibold mb-3 tracking-tight">Project Health</p>
            <div className="flex items-end gap-1.5 h-10">
              {[0.4, 0.6, 0.3, 0.8, 1, 0.7].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-brand-primary/25 rounded-sm"
                  style={{ height: `${h * 100}%`, backgroundColor: h > 0.7 ? '#8B5CF6' : undefined }}
                />
              ))}
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-3">Stable execution pace</p>
          </div>
        </motion.div>
      </section>

      {/* Trust bar */}
      <section className="py-14 border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-10">
          <p className="text-xs font-medium tracking-widest uppercase text-[var(--muted)]">Trusted by industry leaders</p>
          <div className="flex flex-wrap justify-center lg:justify-end gap-x-12 gap-y-6 text-base font-semibold opacity-40 tracking-tight hover:opacity-70 transition-opacity duration-500">
            <span>LAYER</span>
            <span>QUARTZ</span>
            <span>NOTION</span>
            <span>VELOCITY</span>
            <span>FORGE</span>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-28 px-6 bg-[var(--background)]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="font-display text-3xl lg:text-5xl font-semibold tracking-[-0.025em] text-[var(--foreground)]">
              Everything you need to ship.
            </h2>
            <p className="text-[var(--muted)] text-base lg:text-lg max-w-2xl mx-auto leading-relaxed">
              Multiple task views, deep analytics, and AI-driven workflows — built for scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <Card key={idx} className="group">
                <div className="size-11 rounded-xl bg-brand-primary/[0.08] text-brand-primary flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2 tracking-tight">{feature.title}</h3>
                <p className="text-[var(--muted)] text-sm leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-24 bg-slate-950 dark:bg-[#101418] text-white px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/[0.18] via-transparent to-brand-accent/[0.18] opacity-60" />
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16 relative z-10 text-center">
          {[
            { value: "98%", label: "Satisfaction rate" },
            { value: "1.2M+", label: "Tasks managed monthly" },
            { value: "50k+", label: "Global teams" },
          ].map((s) => (
            <div key={s.label} className="space-y-3">
              <p className="font-display text-5xl lg:text-6xl font-semibold tracking-[-0.03em]">{s.value}</p>
              <p className="text-slate-400 text-sm tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-3xl p-12 lg:p-20 text-center relative overflow-hidden shadow-[0_40px_80px_-40px_rgba(15,23,42,0.35)]">
          <div className="absolute -top-24 -left-24 size-96 bg-brand-primary/20 rounded-full blur-3xl opacity-60" />
          <div className="absolute -bottom-24 -right-24 size-96 bg-brand-accent/20 rounded-full blur-3xl opacity-60" />

          <div className="relative z-10 space-y-5">
            <h2 className="font-display text-4xl lg:text-6xl font-semibold tracking-[-0.03em] leading-[1.05] text-white">
              Ready to move faster?
            </h2>
            <p className="text-base lg:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
              Join 50,000+ teams that use Taskflow to organize projects and ship with confidence.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative z-10 mt-8">
            <Button size="lg" to="/login?mode=signup" className="w-full sm:w-auto min-w-[200px]">
              Get started free
            </Button>
            <Button variant="outline" size="lg" to="/contact" className="w-full sm:w-auto min-w-[200px] border-white/20 text-white hover:bg-white/10">
              Talk to sales
            </Button>
          </div>
          <p className="text-xs text-slate-500 relative z-10 mt-5">No credit card required · Cancel anytime</p>
        </div>
      </section>
    </div>
  );
}
