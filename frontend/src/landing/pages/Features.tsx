import { motion } from "motion/react";
import {
  Layout, Calendar, Layers, Activity, Lock, Bot, MousePointer2,
  CheckCircle2, Clock, Users, Sparkles, BarChart3, MessageSquare,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import {
  PageShell, Container, Section, PageHeader, SectionHead,
  Card, IconBadge, Grid, CtaPanel, BRAND, tone, display,
} from "../lib/ui";

const pillars = [
  {
    icon: <Layout size={22} />,
    title: "Task management",
    desc: "Subtasks, multiple assignees, priorities, due dates with time, project context, and a live history timeline.",
    bullets: ["Submit-for-review with notes", "Real-time updates", "Nested subtasks"],
  },
  {
    icon: <Calendar size={22} />,
    title: "Calendar & timeline",
    desc: "A calendar for the week ahead, a timeline for the quarter, and a list when you just need to ship.",
    bullets: ["Drag to reschedule", "Group by assignee", "Detect overlaps"],
  },
  {
    icon: <CheckCircle2 size={22} />,
    title: "Approval workflow",
    desc: "Employees submit work with context. Admins approve, or send it back with a note. Everything is logged.",
    bullets: ["Submission notes per change", "Request changes flow", "Reopen with reason"],
  },
  {
    icon: <Bot size={22} />,
    title: "AI assistant",
    desc: "Summarize a thread, draft a status update, schedule the right meeting. Grounded in your workspace.",
    bullets: ["Per-workspace context", "One-click status reports", "Smart scheduling"],
  },
];

const modules = [
  { icon: <Layout size={18} />, t: "Boards & lists" },
  { icon: <Layers size={18} />, t: "Subtasks" },
  { icon: <Clock size={18} />, t: "Time tracking" },
  { icon: <Activity size={18} />, t: "Reports" },
  { icon: <Lock size={18} />, t: "Role-based access" },
  { icon: <Bot size={18} />, t: "Automations" },
  { icon: <BarChart3 size={18} />, t: "Workload" },
  { icon: <MousePointer2 size={18} />, t: "Drag & drop" },
  { icon: <MessageSquare size={18} />, t: "Comments" },
  { icon: <Calendar size={18} />, t: "iCal sync" },
  { icon: <Users size={18} />, t: "Multi-assignees" },
  { icon: <Sparkles size={18} />, t: "AI summaries" },
];

export default function Features() {
  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="Features"
          title={
            <>
              Built for execution.
              <br />
              <span style={{ color: tone.muted }}>Beyond management.</span>
            </>
          }
          blurb="A focused suite of modules built to bring clarity to complex projects and alignment to fast-moving teams."
        />

        {/* Four big pillars */}
        <Grid min={320} gap={20} style={{ marginBottom: 96 }}>
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Card style={{ padding: 32, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                  <IconBadge>{p.icon}</IconBadge>
                  <h3
                    style={{
                      ...display,
                      fontSize: 22,
                      fontWeight: 600,
                      margin: 0,
                      color: tone.fg,
                    }}
                  >
                    {p.title}
                  </h3>
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: tone.muted, margin: "0 0 20px" }}>
                  {p.desc}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {p.bullets.map((b) => (
                    <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: tone.fg }}>
                      <CheckCircle2 size={16} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </Grid>

        {/* Module grid */}
        <Section pad="tight" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <SectionHead eyebrow="More modules" title="Everything else, too." align="left" />
          <Grid min={220} gap={16}>
            {modules.map((m) => (
              <div
                key={m.t}
                style={{
                  padding: 18,
                  borderRadius: 14,
                  border: `1px solid ${tone.border}`,
                  background: tone.card,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `${BRAND}14`,
                    color: BRAND,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {m.icon}
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em", color: tone.fg }}>
                  {m.t}
                </span>
              </div>
            ))}
          </Grid>
        </Section>

        {/* CTA */}
        <div style={{ marginTop: 32 }}>
          <CtaPanel title="Ship faster, with less friction.">
            <Button size="lg" to="/login?mode=signup">
              Start free
            </Button>
            <Button
              size="lg"
              to="/pricing"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              View pricing
            </Button>
          </CtaPanel>
        </div>
      </Container>
    </PageShell>
  );
}
