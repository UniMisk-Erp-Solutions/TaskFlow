import { motion } from "motion/react";
import {
  Search, Users, Layout, Zap, Settings, HelpCircle, BookOpen,
  Activity, Calendar, Bot, Shield, ArrowRight,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { PageShell, Container, Section, PageHeader, SectionHead, CtaPanel } from "../components/ui/Section";

const quickStart = [
  { title: "Workspace setup", icon: <Settings size={18} />, description: "Configure your team's main workspace in under five minutes." },
  { title: "Project planning", icon: <Layout size={18} />, description: "Build and manage project workflows that survive scope changes." },
  { title: "Task management", icon: <Zap size={18} />, description: "Creating, assigning, and tracking work — the right way." },
  { title: "Team collaboration", icon: <Users size={18} />, description: "Mention teammates and manage discussions in context." },
];

const categories = [
  {
    title: "Getting started",
    icon: <BookOpen size={18} />,
    articles: ["Create your workspace", "Invite teammates", "Your first project", "Connect calendars"],
  },
  {
    title: "Tasks & projects",
    icon: <Layout size={18} />,
    articles: ["Subtasks and dependencies", "Multiple assignees", "Due dates with time", "Status and priority"],
  },
  {
    title: "Approval workflow",
    icon: <Activity size={18} />,
    articles: ["Submit for review", "Approving work", "Requesting changes", "Reading the history timeline"],
  },
  {
    title: "Calendar & timeline",
    icon: <Calendar size={18} />,
    articles: ["Switching views", "Rescheduling tasks", "Sharing a public calendar", "Time zones"],
  },
  {
    title: "AI assistant",
    icon: <Bot size={18} />,
    articles: ["Asking grounded questions", "Generating status reports", "Smart scheduling", "Privacy boundaries"],
  },
  {
    title: "Admin & security",
    icon: <Shield size={18} />,
    articles: ["SSO setup", "Role-based access", "Audit logs", "Data export"],
  },
];

export default function Docs() {
  const supportEmail = "info@unimisk.com";

  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="Documentation"
          title="Taskflow Docs"
          blurb="Set up your workspace, manage projects, automate workflows, and collaborate with your team."
        />

        {/* Search */}
        <div className="max-w-xl mx-auto mb-16 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-brand-primary transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search documentation…"
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary/40 transition-all"
          />
        </div>

        {/* Quick start */}
        <Section pad="tight" className="!py-0 mb-20">
          <SectionHead eyebrow="Quick start" title="Start here." align="left" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {quickStart.map((s, idx) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: idx * 0.04 }}
                className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-brand-primary/40 hover:-translate-y-0.5 transition-all cursor-pointer group"
              >
                <div className="size-10 rounded-lg bg-brand-primary/[0.08] text-brand-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  {s.icon}
                </div>
                <h3 className="font-semibold tracking-tight text-sm mb-1.5">{s.title}</h3>
                <p className="text-xs text-[var(--muted)] leading-relaxed">{s.description}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* Category index */}
        <Section pad="tight" className="!py-0 mb-20">
          <SectionHead eyebrow="Topics" title="Browse by category." align="left" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((cat) => (
              <div key={cat.title} className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="size-9 rounded-lg bg-brand-primary/[0.08] text-brand-primary flex items-center justify-center">
                    {cat.icon}
                  </div>
                  <h3 className="font-semibold tracking-tight">{cat.title}</h3>
                </div>
                <ul className="space-y-2.5">
                  {cat.articles.map((a) => (
                    <li key={a}>
                      <a href="#" className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-brand-primary transition-colors group">
                        <ArrowRight size={12} className="opacity-50 group-hover:translate-x-0.5 transition-transform" />
                        {a}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <CtaPanel
          title={<><HelpCircle className="inline-block mr-3 -mt-1" /> Still need help?</>}
          blurb="If the docs don't answer your question, contact support with your workspace name and a clear description of the issue."
        >
          <Button size="lg" to="/contact">Contact support</Button>
          <a
            href={`mailto:${supportEmail}`}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            or email {supportEmail}
          </a>
        </CtaPanel>
      </Container>
    </PageShell>
  );
}
