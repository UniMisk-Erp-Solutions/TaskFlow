import { motion } from "motion/react";
import { Search, Book, Rocket, Users, Layout, Zap, Settings, HelpCircle } from "lucide-react";

export default function Docs() {
  const productName = "Taskflow";
  const supportEmail = "info@unimisk.com";

  const sections = [
    { title: "Workspace Setup", icon: <Settings size={20} />, description: "Learn how to configure your team's main workspace." },
    { title: "Project Planning", icon: <Layout size={20} />, description: "Detailed guide on building and managing project workflows." },
    { title: "Task Management", icon: <Zap size={20} />, description: "Core concepts of creating, assigning, and tracking tasks." },
    { title: "Team Collaboration", icon: <Users size={20} />, description: "How to mention teammates and manage discussions." },
  ];

  return (
    <div className="pt-32 pb-20 px-6">
      <div className="max-w-5xl mx-auto space-y-16">
        <div className="text-center space-y-6">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-6xl font-bold"
          >
            {productName} Docs
          </motion.h1>
          <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto">
            Learn how to set up your workspace, manage projects, assign tasks, automate workflows, and collaborate with your team.
          </p>
          
          <div className="max-w-xl mx-auto relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-brand-primary transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Search documentation..." 
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all minimal-shadow"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sections.map((section, idx) => (
            <div key={idx} className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-brand-primary/30 transition-all cursor-pointer group">
              <div className="size-10 rounded-xl bg-[var(--primary-soft)] text-brand-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {section.icon}
              </div>
              <h3 className="font-bold mb-2">{section.title}</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">{section.description}</p>
            </div>
          ))}
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-12 text-[var(--foreground)] leading-relaxed">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Introduction</h2>
            <p>
              Welcome to the {productName} documentation center. These docs are designed to help users, teams, administrators, 
              and business customers understand how to set up, manage, and get the most value from the platform.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Workspaces</h2>
            <p>
              A workspace is the main area where your team’s projects, tasks, members, files, settings, and activity are managed. 
              Inside a workspace, you can create projects, invite members, assign roles, and configure permissions.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Projects and Tasks</h2>
            <p>
              Projects are used to group related tasks around a specific goal. Tasks are the basic building blocks, 
              including titles, descriptions, assignees, due dates, priorities, and status updates.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Views (Board, Calendar, Timeline)</h2>
            <p>
              Use the Board view for visual task tracking through columns. The Calendar and Timeline views help teams 
              understand deadlines, schedules, and dependencies clearly.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Automations</h2>
            <p>
              Automations help reduce repetitive manual work by creating rules that respond to changes. For example, 
              sending reminders before due dates or moving tasks when checklists are complete.
            </p>
          </section>

          <div className="py-24 px-4 relative overflow-hidden">
            <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-[3rem] p-12 lg:p-24 text-center space-y-10 shadow-2xl">
              <div className="flex items-center justify-center gap-4 text-brand-primary mb-6">
                <HelpCircle size={48} />
              </div>
              <h2 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter text-white">Still need help?</h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
                If the docs do not solve your problem, contact support with your workspace name and a clear description of the issue.
              </p>
              <div className="flex justify-center">
                <Button size="lg" to="/contact" className="px-10 py-4 text-lg font-black uppercase tracking-tighter">Contact Support</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
