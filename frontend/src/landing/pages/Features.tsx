import { motion } from "motion/react";
import { Layout, Calendar, Layers, Activity, Lock, Bot, MousePointer2 } from "lucide-react";
import { Card } from "../components/ui/Card";

export default function Features() {
  const categories = [
    {
      title: "Task Management",
      icon: <Layout className="text-brand-primary" />,
      features: ["Subtasks", "Priorities", "Labels", "Due dates", "Attachments", "Mentions"]
    },
    {
      title: "Project Planning",
      icon: <Calendar className="text-emerald-500" />,
      features: ["Kanban Boards", "Timeline", "Calendar", "Milestones", "Dependencies", "Templates"]
    },
    {
      title: "Automation & AI",
      icon: <Bot className="text-brand-accent" />,
      features: ["Recurring tasks", "Auto reminders", "Status changes", "Quest AI Summaries", "Smart Scheduling"]
    },
    {
      title: "Reporting",
      icon: <Activity className="text-amber-500" />,
      features: ["Team workload", "Completion rate", "Delay tracking", "Custom dashboards", "Export PDF/CSV"]
    }
  ];

  return (
    <div className="pt-32 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20 space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-7xl font-bold font-display"
          >
            Built for execution. <br />
            <span className="text-brand-accent">Beyond management.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg lg:text-xl text-[var(--muted)] max-w-3xl mx-auto"
          >
            A powerful suite of modules designed to bring clarity to complex projects and 
            alignment to fast-moving teams.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-32">
          {categories.map((cat, i) => (
            <div key={i}>
              <Card className="p-8 lg:p-12 space-y-8 overflow-hidden group h-full">
                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-2xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center">
                    {cat.icon}
                  </div>
                  <h3 className="text-3xl font-bold">{cat.title}</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {cat.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                      <div className="size-1.5 rounded-full bg-brand-primary" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <div className="h-40 bg-brand-primary/5 rounded-2xl border border-dashed border-brand-primary/20 flex items-center justify-center text-brand-primary/40">
                    <Activity size={48} className="animate-pulse" />
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>

        <section className="py-24 px-4 mb-20 relative overflow-hidden">
          <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-[3rem] p-12 lg:p-24 text-center shadow-2xl">
            <h2 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter mb-16 underline decoration-brand-primary decoration-8 underline-offset-8 text-white">Security at the core</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-left">
              {[
                { icon: <Lock className="size-8" />, title: "256-bit Encryption", desc: "All data is encrypted in transit and at rest." },
                { icon: <Layers className="size-8" />, title: "Role-based Access", desc: "Total control over who sees what." },
                { icon: <MousePointer2 className="size-8" />, title: "Audit Logs", desc: "Detailed records of every meaningful action." }
              ].map((s, i) => (
                <div key={i} className="space-y-4 p-6 rounded-2xl border border-white/10 bg-white/5 hover:border-brand-primary/50 transition-colors group">
                  <div className="text-brand-primary group-hover:scale-110 transition-transform">
                    {s.icon}
                  </div>
                  <h4 className="font-black uppercase tracking-tight text-lg text-white">{s.title}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed font-medium">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
