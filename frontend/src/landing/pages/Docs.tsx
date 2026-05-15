import { motion } from "motion/react";
import { Search, Users, Layout, Zap, Settings, HelpCircle } from "lucide-react";
import { Button } from "../components/ui/Button";

export default function Docs() {
  const productName = "Taskflow";
  const supportEmail = "info@unimisk.com";

  const sections = [
    { title: "Workspace setup", icon: <Settings size={18} />, description: "Learn how to configure your team's main workspace." },
    { title: "Project planning", icon: <Layout size={18} />, description: "Detailed guide on building and managing project workflows." },
    { title: "Task management", icon: <Zap size={18} />, description: "Core concepts of creating, assigning, and tracking tasks." },
    { title: "Team collaboration", icon: <Users size={18} />, description: "Mention teammates and manage discussions." },
  ];

  return (
    <div className="pt-32 pb-24 px-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-16">
        <div className="text-center space-y-5">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.05]"
          >
            {productName} Docs
          </motion.h1>
          <p className="text-base lg:text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
            Learn how to set up your workspace, manage projects, assign tasks, automate workflows, and collaborate with your team.
          </p>

          <div className="max-w-xl mx-auto relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-brand-primary transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search documentation…"
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary/40 transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {sections.map((section, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-brand-primary/40 hover:-translate-y-0.5 transition-all cursor-pointer group"
            >
              <div className="size-10 rounded-lg bg-[var(--primary-soft)] text-brand-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                {section.icon}
              </div>
              <h3 className="font-semibold tracking-tight text-sm mb-1.5">{section.title}</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">{section.description}</p>
            </div>
          ))}
        </div>

        <div className="max-w-none space-y-10 text-[var(--foreground)] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight font-display">Introduction</h2>
            <p>
              Welcome to the {productName} documentation. These docs help users, teams, administrators, and customers
              understand how to set up, manage, and get the most value from the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight font-display">Workspaces</h2>
            <p>
              A workspace is the main area where your team's projects, tasks, members, files, settings, and activity
              are managed. Inside a workspace you can create projects, invite members, assign roles, and configure permissions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight font-display">Projects and tasks</h2>
            <p>
              Projects group related tasks around a specific goal. Tasks are the basic building blocks — title,
              description, assignees, due dates, priorities, and status updates.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight font-display">Views — board, calendar, timeline</h2>
            <p>
              Use the Board view for visual tracking through columns. Calendar and Timeline help teams understand
              deadlines, schedules, and dependencies clearly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight font-display">Automations</h2>
            <p>
              Automations reduce repetitive manual work by creating rules that respond to changes — like sending
              reminders before due dates or moving tasks when checklists complete.
            </p>
          </section>

          <div className="pt-8">
            <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-3xl p-12 lg:p-20 text-center space-y-7 shadow-[0_40px_80px_-40px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-center text-brand-primary">
                <HelpCircle size={40} />
              </div>
              <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em] text-white">
                Still need help?
              </h2>
              <p className="text-base lg:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
                If the docs don't answer your question, contact support with your workspace name
                and a clear description of the issue.
              </p>
              <div className="flex justify-center">
                <Button size="lg" to="/contact">Contact support</Button>
              </div>
              <p className="text-xs text-slate-500">
                Email · <span className="text-slate-300">{supportEmail}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
