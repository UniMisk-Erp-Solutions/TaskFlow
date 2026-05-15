import { motion } from "motion/react";
import {
  Layout, Calendar, Layers, Activity, Lock, Bot, MousePointer2,
  CheckCircle2, Clock, Users, Sparkles, BarChart3, MessageSquare,
} from "lucide-react";
import { Button } from "../components/ui/Button";

function Showcase({
  eyebrow,
  title,
  desc,
  bullets,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  bullets: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${reverse ? "lg:[&>div:first-child]:order-2" : ""}`}>
      <div className="space-y-5">
        <p className="text-xs font-semibold tracking-[0.15em] uppercase text-brand-primary/80">{eyebrow}</p>
        <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em] leading-[1.1]">{title}</h2>
        <p className="text-base text-[var(--muted)] leading-relaxed">{desc}</p>
        <ul className="space-y-2 pt-2">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>{visual}</div>
    </div>
  );
}

function VisualPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_48px_-24px_rgba(15,23,42,0.18)] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/[0.06] via-transparent to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

export default function Features() {
  return (
    <div className="pt-32 pb-24 px-6 font-sans">
      {/* Header */}
      <div className="max-w-5xl mx-auto text-center mb-24 space-y-5">
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-xs font-semibold tracking-[0.15em] uppercase text-brand-primary/80"
        >
          Features
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          className="font-display text-4xl lg:text-6xl font-semibold tracking-[-0.03em] leading-[1.05]"
        >
          Built for execution.<br />
          <span className="text-brand-accent">Beyond management.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="text-base lg:text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed"
        >
          A focused suite of modules built to bring clarity to complex projects
          and alignment to fast-moving teams.
        </motion.p>
      </div>

      <div className="max-w-6xl mx-auto space-y-28">

        <Showcase
          eyebrow="Tasks"
          title="A clean primitive for getting work done."
          desc="Subtasks, multiple assignees, priorities, due dates with time, project context, and a live history timeline — all without ceremony."
          bullets={[
            "Submit for review with notes — admin approves or reopens",
            "Real-time updates and notifications",
            "Nested subtasks for shipping complex work",
          ]}
          visual={
            <VisualPanel>
              <div className="space-y-2.5">
                {[
                  { t: "Audit Q3 marketing copy", s: "Submitted", color: "amber" },
                  { t: "Update API documentation", s: "In Progress", color: "indigo" },
                  { t: "Sync with Engineering Lead", s: "Pending", color: "slate" },
                  { t: "Q2 retrospective notes", s: "Completed", color: "emerald" },
                ].map((row) => (
                  <div key={row.t} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/40">
                    <div className={`size-4 rounded-md border-2 ${row.color === "emerald" ? "bg-emerald-500 border-emerald-500" : "border-[var(--border)]"}`} />
                    <p className={`flex-1 text-sm ${row.color === "emerald" ? "line-through text-[var(--muted)]" : ""}`}>{row.t}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      row.color === "amber" ? "bg-amber-500/[0.12] text-amber-600" :
                      row.color === "indigo" ? "bg-brand-primary/[0.12] text-brand-primary" :
                      row.color === "emerald" ? "bg-emerald-500/[0.12] text-emerald-600" :
                      "bg-slate-500/[0.12] text-slate-500"
                    }`}>{row.s}</span>
                  </div>
                ))}
              </div>
            </VisualPanel>
          }
        />

        <Showcase
          reverse
          eyebrow="Calendar & timeline"
          title="See time the way your team thinks."
          desc="A calendar for the week ahead, a timeline for the quarter, and a list when you just need to ship. Same data, the view you need."
          bullets={[
            "Drag to reschedule across days",
            "Group by assignee or project",
            "Detect overlaps and overloads",
          ]}
          visual={
            <VisualPanel>
              <div className="grid grid-cols-7 gap-1 text-[10px] text-[var(--muted)] mb-2">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <p key={i} className="text-center font-semibold">{d}</p>)}
              </div>
              <div className="grid grid-cols-7 grid-rows-4 gap-1">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg border border-[var(--border)] bg-[var(--background)]/40 relative">
                    {(i === 8 || i === 14 || i === 21) && <div className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-brand-primary/70" />}
                    {(i === 9 || i === 15) && <div className="absolute inset-x-1 bottom-2.5 h-1 rounded-full bg-emerald-500/70" />}
                  </div>
                ))}
              </div>
            </VisualPanel>
          }
        />

        <Showcase
          eyebrow="Approval workflow"
          title="The submit-and-approve loop, finally calm."
          desc="Employees submit work with context. Admins approve, or send it back with a note. Everything is logged into a live, real-time timeline."
          bullets={[
            "Submission notes attached to every status change",
            "Admin can request changes with feedback",
            "Reopen flow keeps history intact",
          ]}
          visual={
            <VisualPanel>
              <ol className="relative space-y-4 pl-6 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--border)]">
                {[
                  { who: "Maya", act: "created the task", color: "slate" },
                  { who: "Maya", act: "submitted for review", color: "amber" },
                  { who: "Owen", act: "requested changes", color: "red" },
                  { who: "Maya", act: "submitted again", color: "amber" },
                  { who: "Owen", act: "approved", color: "emerald" },
                ].map((e, i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-6 top-1 size-3 rounded-full ring-2 ring-[var(--card)] ${
                      e.color === "emerald" ? "bg-emerald-500" :
                      e.color === "amber" ? "bg-amber-500" :
                      e.color === "red" ? "bg-red-500" : "bg-slate-400"
                    }`} />
                    <p className="text-sm"><strong className="tracking-tight">{e.who}</strong> {e.act}</p>
                  </li>
                ))}
              </ol>
            </VisualPanel>
          }
        />

        <Showcase
          reverse
          eyebrow="AI assistant"
          title="An AI that knows what you're working on."
          desc="Summarize a thread, draft a status update, schedule the right meeting. Grounded in your workspace, not the open internet."
          bullets={[
            "Per-workspace context only — never leaks across orgs",
            "Generate status reports in one click",
            "Smart scheduling that respects calendars",
          ]}
          visual={
            <VisualPanel>
              <div className="space-y-3">
                <div className="flex gap-2.5 items-start">
                  <div className="size-7 rounded-lg bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] shrink-0"><Users size={14} /></div>
                  <div className="bg-[var(--background)]/40 border border-[var(--border)] rounded-2xl rounded-tl-sm p-3 text-sm max-w-xs">Where are we on the Q3 launch?</div>
                </div>
                <div className="flex gap-2.5 items-start flex-row-reverse">
                  <div className="size-7 rounded-lg bg-brand-primary/[0.12] text-brand-primary flex items-center justify-center shrink-0"><Sparkles size={14} /></div>
                  <div className="bg-brand-primary/[0.06] border border-brand-primary/15 rounded-2xl rounded-tr-sm p-3 text-sm max-w-xs">
                    7 tasks shipped, 3 in review. Maya's blocker resolved yesterday. Demo deck due Thu.
                  </div>
                </div>
              </div>
            </VisualPanel>
          }
        />
      </div>

      {/* Module grid */}
      <section className="max-w-6xl mx-auto mt-32">
        <div className="text-center mb-12 space-y-3">
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-brand-primary/80">More modules</p>
          <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
            Everything else, too.
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: <Layout />, t: "Boards & lists" },
            { icon: <Layers />, t: "Subtasks" },
            { icon: <Clock />, t: "Time tracking" },
            { icon: <Activity />, t: "Reports" },
            { icon: <Lock />, t: "Role-based access" },
            { icon: <Bot />, t: "Automations" },
            { icon: <BarChart3 />, t: "Workload" },
            { icon: <MousePointer2 />, t: "Drag & drop" },
            { icon: <MessageSquare />, t: "Comments & mentions" },
            { icon: <Calendar />, t: "iCal sync" },
            { icon: <Users />, t: "Multi-assignees" },
            { icon: <CheckCircle2 />, t: "Approval flow" },
          ].map((m) => (
            <div key={m.t} className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-brand-primary/30 transition-colors flex items-center gap-3">
              <div className="size-9 rounded-lg bg-brand-primary/[0.08] text-brand-primary flex items-center justify-center">{m.icon}</div>
              <span className="text-sm font-medium tracking-tight">{m.t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto mt-28">
        <div className="bg-slate-950 border border-white/10 rounded-3xl p-12 lg:p-16 text-center shadow-[0_40px_80px_-40px_rgba(15,23,42,0.4)] space-y-7 relative overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 size-96 bg-brand-primary/20 rounded-full blur-3xl opacity-60" />
          <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em] text-white relative">
            Ship faster, with less friction.
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative">
            <Button size="lg" to="/login?mode=signup" className="min-w-[200px]">Start free</Button>
            <Button size="lg" to="/pricing" variant="outline" className="min-w-[200px] border-white/20 text-white hover:bg-white/10">View pricing</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
