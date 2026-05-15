import { motion } from "motion/react";
import {
  Layout, Calendar, Layers, Activity, Lock, Bot, MousePointer2,
  CheckCircle2, Clock, Users, Sparkles, BarChart3, MessageSquare,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { PageShell, Container, Section, PageHeader, SectionHead, CtaPanel } from "../components/ui/Section";

const pillars = [
  {
    icon: <Layout />,
    title: "Task management",
    desc: "Subtasks, multiple assignees, priorities, due dates with time, project context, and a live history timeline.",
    bullets: ["Submit-for-review with notes", "Real-time updates", "Nested subtasks"],
  },
  {
    icon: <Calendar />,
    title: "Calendar & timeline",
    desc: "A calendar for the week ahead, a timeline for the quarter, and a list when you just need to ship.",
    bullets: ["Drag to reschedule", "Group by assignee", "Detect overlaps"],
  },
  {
    icon: <CheckCircle2 />,
    title: "Approval workflow",
    desc: "Employees submit work with context. Admins approve, or send it back with a note. Everything is logged.",
    bullets: ["Submission notes per change", "Request changes flow", "Reopen with reason"],
  },
  {
    icon: <Bot />,
    title: "AI assistant",
    desc: "Summarize a thread, draft a status update, schedule the right meeting. Grounded in your workspace.",
    bullets: ["Per-workspace context", "One-click status reports", "Smart scheduling"],
  },
];

const modules = [
  { icon: <Layout />, t: "Boards & lists" },
  { icon: <Layers />, t: "Subtasks" },
  { icon: <Clock />, t: "Time tracking" },
  { icon: <Activity />, t: "Reports" },
  { icon: <Lock />, t: "Role-based access" },
  { icon: <Bot />, t: "Automations" },
  { icon: <BarChart3 />, t: "Workload" },
  { icon: <MousePointer2 />, t: "Drag & drop" },
  { icon: <MessageSquare />, t: "Comments" },
  { icon: <Calendar />, t: "iCal sync" },
  { icon: <Users />, t: "Multi-assignees" },
  { icon: <Sparkles />, t: "AI summaries" },
];

export default function Features() {
  return (
    <PageShell>
      <Container width="6xl">
        <PageHeader
          eyebrow="Features"
          title={<>Built for execution.<br /><span className="text-brand-accent">Beyond management.</span></>}
          blurb="A focused suite of modules built to bring clarity to complex projects and alignment to fast-moving teams."
        />

        {/* Four big pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-24">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 hover:border-brand-primary/30 transition-colors"
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                  {p.icon}
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight">{p.title}</h3>
              </div>
              <p className="text-sm text-[var(--muted)] leading-relaxed mb-5">{p.desc}</p>
              <ul className="space-y-2">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Module grid */}
        <Section pad="tight" className="px-0">
          <SectionHead eyebrow="More modules" title="Everything else, too." align="left" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {modules.map((m) => (
              <div
                key={m.t}
                className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-brand-primary/30 transition-colors flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
                  {m.icon}
                </div>
                <span className="text-sm font-medium tracking-tight">{m.t}</span>
              </div>
            ))}
          </div>
        </Section>

        <CtaPanel title="Ship faster, with less friction.">
          <Button size="lg" to="/login?mode=signup">Start free</Button>
          <Button size="lg" to="/pricing" variant="outline" className="border-white/20 text-white hover:bg-white/10">
            View pricing
          </Button>
        </CtaPanel>
      </Container>
    </PageShell>
  );
}
