import { motion } from "motion/react";
import { Layout, Calendar, Layers, Activity, Lock, Bot, MousePointer2 } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export default function Features() {
  const categories = [
    {
      title: "Task management",
      icon: <Layout className="text-brand-primary" />,
      features: ["Subtasks", "Priorities", "Labels", "Due dates", "Attachments", "Mentions"],
    },
    {
      title: "Project planning",
      icon: <Calendar className="text-emerald-500" />,
      features: ["Kanban boards", "Timeline", "Calendar", "Milestones", "Dependencies", "Templates"],
    },
    {
      title: "Automation & AI",
      icon: <Bot className="text-brand-accent" />,
      features: ["Recurring tasks", "Auto reminders", "Status changes", "AI summaries", "Smart scheduling"],
    },
    {
      title: "Reporting",
      icon: <Activity className="text-amber-500" />,
      features: ["Team workload", "Completion rate", "Delay tracking", "Custom dashboards", "Export PDF/CSV"],
    },
  ];

  return (
    <div className="pt-32 pb-24 px-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20 space-y-5">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl lg:text-6xl font-semibold tracking-[-0.03em] leading-[1.05]"
          >
            Built for execution.<br />
            <span className="text-brand-accent">Beyond management.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="text-base lg:text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed"
          >
            A focused suite of modules designed to bring clarity to complex projects
            and alignment to fast-moving teams.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-28">
          {categories.map((cat, i) => (
            <Card key={i} className="p-9 space-y-7 group h-full">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center">
                  {cat.icon}
                </div>
                <h3 className="text-2xl font-semibold tracking-tight font-display">{cat.title}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {cat.features.map((f) => (
                  <div key={f} className="flex items-center gap-2.5 text-sm text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                    <div className="size-1.5 rounded-full bg-brand-primary" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <div className="h-32 bg-brand-primary/[0.04] rounded-xl border border-dashed border-brand-primary/15 flex items-center justify-center text-brand-primary/30">
                  <Activity size={36} className="animate-pulse" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <section className="mb-16">
          <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-3xl p-12 lg:p-20 text-center shadow-[0_40px_80px_-40px_rgba(15,23,42,0.35)]">
            <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em] mb-12 text-white">
              Security at the core
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {[
                { icon: <Lock className="size-7" />, title: "256-bit encryption", desc: "All data is encrypted in transit and at rest." },
                { icon: <Layers className="size-7" />, title: "Role-based access", desc: "Total control over who sees what." },
                { icon: <MousePointer2 className="size-7" />, title: "Audit logs", desc: "Detailed records of every meaningful action." },
              ].map((s, i) => (
                <div key={i} className="space-y-3 p-6 rounded-2xl border border-white/10 bg-white/[0.04] hover:border-brand-primary/40 transition-colors group">
                  <div className="text-brand-primary group-hover:scale-105 transition-transform">{s.icon}</div>
                  <h4 className="font-semibold tracking-tight text-base text-white">{s.title}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-12">
              <Button size="lg" to="/security" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Learn more about security
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
