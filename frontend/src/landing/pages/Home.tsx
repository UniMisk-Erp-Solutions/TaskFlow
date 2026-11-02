import { useContext } from "react";
import type { ReactNode, CSSProperties } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Zap, Users, Clock, Sparkles, ListChecks, CalendarDays, LayoutGrid,
  CheckCircle2, MessageSquare, ChevronDown, GitBranch, History, FolderOpen, PenLine, CalendarOff, Smartphone, BookOpen,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { HOME_FAQS } from "../../seo/homeFaqs.js";
import { SceneContext } from "../lib/sceneContext";

/**
 * Marketing Home page.
 *
 * Layout is authored with **inline React styles only** (no Tailwind utility
 * classes for spacing/sizing/positioning). This is deliberate — production
 * caches at any layer (Coolify, CDN, browser, service-worker) cannot serve a
 * "Tailwind-broken" version of this page because there are no Tailwind classes
 * to drop. CSS variables (`--background`, `--foreground`, `--border`, ...) are
 * declared inline in index.html's critical CSS *and* by Tailwind v4's `@theme`
 * block in src/index.css, so colours flip correctly between light and dark.
 *
 * Buttons (`<Button>`) and small chips still use Tailwind for paint polish,
 * but their structural placement is owned by inline styles here, which means
 * cards never collapse to a single column when Tailwind misses a build.
 */

const PRIMARY = "#8B5CF6";
const ACCENT = "#C084FC";

// Home page copy. Claims describe what the app does or repeat the Pricing page (see docs/seo.md): no ratings or user counts.
const features = [
  { icon: <ListChecks size={20} />, title: "Team task tracking software", desc: "Track every task your team owns by status, priority and due date, with subtasks to break big work into steps." },
  { icon: <Users size={20} />, title: "Task assignment software for teams", desc: "Assign a task to one person or to several, so everyone knows what is theirs and who else is on it." },
  { icon: <LayoutGrid size={20} />, title: "Kanban board software for teams", desc: "Drag tasks across Backlog, To Do, In Progress and Done. Board moves update the same tasks as the list." },
  { icon: <CalendarDays size={20} />, title: "Online task planner with calendar", desc: "See deadlines and meetings on a team calendar, with optional Google Calendar sync." },
  { icon: <Clock size={20} />, title: "Team time tracking software", desc: "Start and pause a timer on the task you are working on, then review time by task and by person." },
  { icon: <Sparkles size={20} />, title: "AI task assistant", desc: "Ask the assistant to create and update tasks in plain language, so planning takes less typing." },
];

const steps = [
  { n: "01", icon: <Users size={20} />, title: "Bring the team in", desc: "Invite teammates, set their roles and group work into projects in under a minute." },
  { n: "02", icon: <Zap size={20} />, title: "Plan and assign", desc: "Break work into tasks and subtasks, set priorities and due dates, then assign them to your team." },
  { n: "03", icon: <CheckCircle2 size={20} />, title: "Submit and approve", desc: "Employees submit finished work for review. Reviewers approve it or send it back, and every step is logged." },
];


const githubPoints = [
  "Link GitHub commits to tasks by putting the task ID in the branch name or commit message.",
  "Track GitHub work for your team: pushes and pull requests show up on the task they belong to.",
  "Pushes can move a task from In Progress to Done and submit it for admin approval, even when TaskFlow is closed.",
];

const guides = [
  { to: "/blog/task-approval-workflow", label: "How to create a task approval workflow", blurb: "Who should review, what to include in a submission and how to keep reviews quick." },
  { to: "/blog/weekly-planning-template", label: "Weekly planning template for teams", blurb: "Plan your week in 20 minutes with a simple repeatable template." },
  { to: "/blog/how-to-prioritize-tasks", label: "How to prioritize team tasks", blurb: "Five practical methods for deciding what to do first." },
  { to: "/blog/kanban-vs-to-do-list", label: "Kanban vs. to-do list for teams", blurb: "Which one fits your team, and when to switch." },
];

const facts = [
  { v: "$0", l: "Free plan" },
  { v: "7 days", l: "Pro trial" },
  { v: "2 steps", l: "Manager, then admin approval" },
  { v: "4 lanes", l: "Kanban board" },
];

// ─── Tokens ────────────────────────────────────────────────────────────
const c = {
  bg: "var(--background)",
  fg: "var(--foreground)",
  muted: "var(--muted)",
  card: "var(--card)",
  border: "var(--border)",
};
const display = {
  fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
  letterSpacing: "-0.025em",
};

// ─── Atoms ─────────────────────────────────────────────────────────────
function Section({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ padding: "80px 24px", background: "transparent", ...style }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p style={{
      fontSize: 12, fontWeight: 600, letterSpacing: "0.16em",
      textTransform: "uppercase", color: PRIMARY, margin: 0,
    }}>{children}</p>
  );
}

function SectionHead({
  eyebrow, title, blurb, align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  blurb?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{
      textAlign: align,
      maxWidth: align === "center" ? 720 : "none",
      margin: align === "center" ? "0 auto 56px" : "0 0 56px",
      display: "flex", flexDirection: "column", gap: 16,
      alignItems: align === "center" ? "center" : "flex-start",
    }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 style={{
        ...display, fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600,
        lineHeight: 1.1, margin: 0, color: c.fg,
      }}>{title}</h2>
      {blurb && (
        <p style={{
          fontSize: 17, lineHeight: 1.65, color: c.muted, margin: 0, maxWidth: 600,
        }}>{blurb}</p>
      )}
    </motion.div>
  );
}

// Cards fade up as they scroll into view and lift slightly on hover.
function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, borderColor: "rgba(139, 92, 246, 0.55)", boxShadow: "0 22px 50px -24px rgba(139, 92, 246, 0.55)" }}
      style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: 16,
        padding: 28,
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

function IconBadge({ children, tint }: { children: ReactNode; tint?: string }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 12,
      background: `${tint || PRIMARY}1A`,
      color: tint || PRIMARY,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      marginBottom: 16,
    }}>{children}</div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────
const RING_CSS = `
.tf-ring{position:absolute;left:50%;top:50%;width:min(88vw,780px);aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none}
.tf-ring-glow,.tf-ring-line{position:absolute;inset:0;border-radius:50%;
  background:conic-gradient(from 0deg,rgba(91,108,255,0) 0deg,#5b6cff 60deg,#9ad8ff 120deg,rgba(91,108,255,0) 190deg,rgba(139,92,246,0) 250deg,#8B5CF6 310deg,rgba(91,108,255,0) 360deg)}
.tf-ring-line{-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px))}
.tf-ring-glow{filter:blur(26px);opacity:.75;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 26px),#000 calc(100% - 4px));mask:radial-gradient(farthest-side,transparent calc(100% - 26px),#000 calc(100% - 4px))}
.tf-ring-fill{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(38,56,190,.30) 0%,rgba(20,28,90,.18) 45%,transparent 68%)}
@keyframes tf-ring-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.tf-ring-glow,.tf-ring-line{animation:none}}
@media (max-width:640px){.tf-hero{padding:100px 20px 44px !important;min-height:100svh !important}}
`;

function Hero({ showFallbackRing }: { showFallbackRing: boolean }) {
  const check = { display: "inline-flex", alignItems: "center", gap: 6 } as const;
  // The hero text drifts up, shrinks and fades as the page scrolls, while the 3D scene behind it flies forward.
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 520], [0, -140]);
  const heroOpacity = useTransform(scrollY, [0, 460], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 520], [1, 0.9]);
  return (
    <section className="tf-hero" style={{
      position: "relative", overflow: "hidden", background: "transparent",
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "132px 24px 96px",
    }}>
      <style>{RING_CSS}</style>
      {showFallbackRing && (
        <div className="tf-ring" aria-hidden="true">
          <div className="tf-ring-fill" />
          <div className="tf-ring-glow" />
          <div className="tf-ring-line" />
        </div>
      )}
      {/* A soft dark pool behind the text keeps it readable over the particles. */}
      <div aria-hidden="true" style={{
        position: "absolute", left: "50%", top: "50%", width: "min(92vw, 900px)", height: 460, transform: "translate(-50%, -50%)",
        background: "radial-gradient(closest-side, var(--scrim), color-mix(in srgb, var(--scrim) 65%, transparent) 55%, transparent)", pointerEvents: "none",
      }} />
      <motion.div style={{
        position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto", textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center",
        y: heroY, opacity: heroOpacity, scale: heroScale,
      }}>
        <p
          aria-hidden="true"
          style={{
            ...display, margin: 0, color: "var(--wordmark)", fontWeight: 500, lineHeight: 1, display: "flex",
            fontSize: "clamp(34px, 9.5vw, 112px)", letterSpacing: "0.34em", paddingLeft: "0.34em",
            textShadow: "0 0 40px var(--wordmark-glow)",
          }}
        >
          {"TASKFLOW".split("").map((ch, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 36, filter: "blur(14px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.15 + i * 0.07, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "inline-block" }}
            >
              {ch}
            </motion.span>
          ))}
        </p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          style={{
            ...display, margin: "36px 0 18px", color: c.fg, fontWeight: 600,
            fontSize: "clamp(14px, 1.9vw, 18px)", letterSpacing: "0.2em", textTransform: "uppercase", lineHeight: 1.5,
          }}
        >
          Task management app for teams
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
          style={{ fontSize: 16, lineHeight: 1.65, color: c.muted, maxWidth: 520, margin: "0 auto 32px" }}
        >
          Task management software for small teams: assign tasks, track time, plan on a
          calendar and approve finished work, all in one shared workspace. Start with a
          free task manager for small teams.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", alignItems: "center" }}
        >
          <Button size="lg" to="/login?mode=signup">
            Start free <ArrowRight style={{ marginLeft: 8, width: 16, height: 16 }} />
          </Button>
          <Button variant="outline" size="lg" to="/features">See how it works</Button>
        </motion.div>

        <div style={{
          marginTop: 24, display: "flex", flexWrap: "wrap", justifyContent: "center",
          gap: "8px 22px", fontSize: 12, color: c.muted,
        }}>
          <span style={check}><CheckCircle2 size={14} color="#10b981" /> No credit card</span>
          <span style={check}><CheckCircle2 size={14} color="#10b981" /> 7-day Pro trial</span>
          <span style={check}><CheckCircle2 size={14} color="#10b981" /> Cancel anytime</span>
        </div>
      </motion.div>
    </section>
  );
}

function FeaturesSection() {
  return (
      <Section>
        <SectionHead
          eyebrow="What's inside"
          title={<>Everything teams need.<br /><span style={{ color: c.muted }}>Nothing they don't.</span></>}
          blurb="Team project planning software that keeps tasks, deadlines, time and approvals in one place."
        />
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}>
          {features.map((f) => (
            <Card key={f.title}>
              <IconBadge>{f.icon}</IconBadge>
              <h3 style={{
                ...display, fontSize: 18, fontWeight: 600, margin: "0 0 8px", color: c.fg,
              }}>{f.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: c.muted, margin: 0 }}>{f.desc}</p>
            </Card>
          ))}
        </div>
      </Section>
  );
}

function HowItWorksSection() {
  return (
      <Section style={{ borderTop: `1px solid ${c.border}` }}>
        <SectionHead
          eyebrow="How it works"
          title={<>From scattered to shipped<br />in three simple steps.</>}
        />
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
        }}>
          {steps.map((s) => (
            <Card key={s.n}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 20,
              }}>
                <span style={{
                  ...display, fontSize: 13, fontWeight: 600,
                  letterSpacing: "0.18em", color: PRIMARY,
                }}>{s.n}</span>
                <IconBadge>{s.icon}</IconBadge>
              </div>
              <h3 style={{
                ...display, fontSize: 18, fontWeight: 600, margin: "0 0 8px", color: c.fg,
              }}>{s.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: c.muted, margin: 0 }}>{s.desc}</p>
            </Card>
          ))}
        </div>
      </Section>
  );
}

function StatsSection() {
  return (
      <section style={{ padding: "40px 24px", background: "transparent" }}>
       <div style={{
         position: "relative", overflow: "hidden", maxWidth: 880, margin: "0 auto",
         background: "var(--card)", color: c.fg, padding: "56px 40px",
         borderRadius: 32, border: "1px solid var(--glass-edge)",
         boxShadow: "inset 0 1px 0 var(--glass-shine), 0 30px 80px -40px var(--glass-shadow)",
       }}>
        <div style={{
          position: "absolute", inset: 0,
          background:
            `radial-gradient(circle at 30% 50%, ${PRIMARY}33, transparent 60%),` +
            `radial-gradient(circle at 70% 50%, ${ACCENT}26, transparent 60%)`,
          opacity: 0.7,
        }} />
        <div style={{
          position: "relative", maxWidth: 1120, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 32, textAlign: "center",
        }}>
          {facts.map((s) => (
            <div key={s.l} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{
                ...display, fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 600, margin: 0,
              }}>{s.v}</p>
              <p style={{
                fontSize: 11, color: c.muted, margin: 0,
                letterSpacing: "0.12em", textTransform: "uppercase",
              }}>{s.l}</p>
            </div>
          ))}
        </div>
       </div>
      </section>
  );
}


const workspaceTools = [
  { icon: <MessageSquare size={20} />, title: "Team chat", desc: "General, group and private chats with replies and attachments, kept next to the work." },
  { icon: <FolderOpen size={20} />, title: "File sharing", desc: "Store and organise your team’s files in folders, then attach them to tasks and meetings." },
  { icon: <CalendarDays size={20} />, title: "Meetings and calendar", desc: "Schedule meetings, attach files and see them on the calendar beside your deadlines." },
  { icon: <PenLine size={20} />, title: "Live whiteboard", desc: "Sketch and plan together on a shared canvas where everyone sees changes as they happen." },
  { icon: <CalendarOff size={20} />, title: "Leave portal", desc: "Let people request time off, and give managers and admins a clear view of who is away." },
  { icon: <Smartphone size={20} />, title: "Mobile app", desc: "Keep up with tasks and notifications on your phone, with push alerts for what needs you." },
];

function WorkspaceSection() {
  return (
      <Section style={{ borderTop: `1px solid ${c.border}` }}>
        <SectionHead
          eyebrow="One workspace"
          title={<>One workspace.<br /><span style={{ color: c.muted }}>Every tool your team needs.</span></>}
          blurb="Stop switching between apps. Chat, files, meetings and planning live next to your tasks."
        />
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
        }}>
          {workspaceTools.map((t) => (
            <Card key={t.title}>
              <IconBadge>{t.icon}</IconBadge>
              <h3 style={{ ...display, fontSize: 18, fontWeight: 600, margin: "0 0 8px", color: c.fg }}>{t.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: c.muted, margin: 0 }}>{t.desc}</p>
            </Card>
          ))}
        </div>
      </Section>
  );
}

function DetailsSection() {
  const items = [
    { icon: <Users size={20} />, title: "Employee task tracking software", desc: "Employees see their own tasks and submit finished work. Managers and admins see the wider picture.", to: "/employee-task-tracking" },
    { icon: <ListChecks size={20} />, title: "Task management with multiple assignees and subtasks", desc: "Give a task to several people and split it into subtasks that you tick off as you go." },
    { icon: <Clock size={20} />, title: "Task time tracking and reporting", desc: "Record time on each task and review it by task and by person, with timer analytics on the Pro plan." },
    { icon: <Users size={20} />, title: "Team workload management software", desc: "Managers see the tasks of their team members, so work can be shared out before someone is overloaded." },
    { icon: <History size={20} />, title: "Task tracking with activity history", desc: "Every change to a task is written to its history, so you can answer who changed what and when.", to: "/task-approval-workflow-software" },
  ];
  return (
      <Section style={{ borderTop: `1px solid ${c.border}` }}>
        <SectionHead
          eyebrow="Work management"
          title={<>Task tracking for teams<br /><span style={{ color: c.muted }}>that shows who is doing what.</span></>}
        />
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}>
          {items.map((it) => (
            <Card key={it.title}>
              <IconBadge>{it.icon}</IconBadge>
              <h3 style={{ ...display, fontSize: 18, fontWeight: 600, margin: "0 0 8px", color: c.fg }}>{it.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: c.muted, margin: 0 }}>{it.desc}</p>
              {it.to && (
                <Link to={it.to} style={{ display: "inline-block", marginTop: 12, fontSize: 14, fontWeight: 500, color: PRIMARY }}>
                  Learn more
                </Link>
              )}
            </Card>
          ))}
        </div>
      </Section>
  );
}

function GithubSection() {
  return (
      <Section style={{ borderTop: `1px solid ${c.border}` }}>
        <SectionHead
          eyebrow="Developers"
          title={<>GitHub integration<br /><span style={{ color: c.muted }}>for task management.</span></>}
          blurb="GitHub task tracking for teams: your code activity updates the task, without anyone retyping it."
        />
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <Card>
            <IconBadge><GitBranch size={20} /></IconBadge>
            <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {githubPoints.map((p) => (
                <li key={p} style={{ fontSize: 15, lineHeight: 1.6, color: c.muted }}>{p}</li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>
  );
}

function GuidesSection() {
  return (
      <Section style={{ borderTop: `1px solid ${c.border}` }}>
        <SectionHead
          eyebrow="Guides"
          title="Practical guides for team task management"
        />
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
        }}>
          {guides.map((g) => (
            <Link key={g.to} to={g.to} style={{ textDecoration: "none" }}>
              <Card style={{ height: "100%" }}>
                <IconBadge><BookOpen size={20} /></IconBadge>
                <h3 style={{ ...display, fontSize: 17, fontWeight: 600, margin: "0 0 8px", color: c.fg }}>{g.label}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: c.muted, margin: 0 }}>{g.blurb}</p>
              </Card>
            </Link>
          ))}
        </div>
      </Section>
  );
}

function FaqSection() {
  return (
      <Section style={{ borderTop: `1px solid ${c.border}` }}>
        <section aria-labelledby="home-faq-heading">
          <SectionHead
            eyebrow="FAQ"
            title={<span id="home-faq-heading">Frequently asked questions</span>}
            blurb="Straight answers about what TaskFlow does, who it is for and how it works."
          />
          {/* Native <details>: keyboard and screen-reader accessible, and every answer is in the page HTML for search engines. */}
          <style>{".tf-faq summary::-webkit-details-marker{display:none}.tf-faq summary svg{transition:transform .2s}.tf-faq[open] summary svg{transform:rotate(180deg)}.tf-faq summary:focus-visible{outline:2px solid #8B5CF6;outline-offset:4px;border-radius:4px}"}</style>
          <div style={{
            maxWidth: 760, margin: "0 auto",
            borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}`,
          }}>
            {HOME_FAQS.map((f: { q: string; a: string }, i: number) => (
              <details key={f.q} className="tf-faq" style={{
                padding: "20px 0",
                borderBottom: i !== HOME_FAQS.length - 1 ? `1px solid ${c.border}` : "none",
              }}>
                <summary style={{
                  cursor: "pointer", listStyle: "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
                }}>
                  <h3 style={{ ...display, fontSize: 17, fontWeight: 600, margin: 0, color: c.fg }}>{f.q}</h3>
                  <ChevronDown size={18} color={c.muted} aria-hidden="true" style={{ flexShrink: 0 }} />
                </summary>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: c.muted, margin: "12px 0 0" }}>{f.a}</p>
              </details>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
            <Button variant="outline" to="/faq" style={{ paddingLeft: 32, paddingRight: 32 }}>Show more questions</Button>
          </div>
        </section>
      </Section>
  );
}

function CtaSection() {
  return (
      <Section>
        <div style={{
          position: "relative", overflow: "hidden",
          background: "var(--card)",
          border: "1px solid var(--glass-edge)",
          borderRadius: 24, padding: "64px 32px",
          textAlign: "center",
          boxShadow: "inset 0 1px 0 var(--glass-shine), 0 40px 80px -40px var(--glass-shadow)",
        }}>
          <div style={{
            position: "absolute", top: -96, left: -96, width: 320, height: 320,
            background: `${PRIMARY}33`, borderRadius: 999, filter: "blur(80px)", opacity: 0.6,
          }} />
          <div style={{
            position: "absolute", bottom: -96, right: -96, width: 320, height: 320,
            background: `${ACCENT}33`, borderRadius: 999, filter: "blur(80px)", opacity: 0.6,
          }} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
            <h2 style={{
              ...display, fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 600,
              lineHeight: 1.1, margin: 0, color: c.fg,
            }}>Bring clarity to your team’s work.</h2>
            <p style={{
              fontSize: 17, lineHeight: 1.6, color: c.muted,
              maxWidth: 520, margin: 0,
            }}>
              A free task manager for small teams. No credit card required to start.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 12 }}>
              <Button size="lg" to="/login?mode=signup">Get started free</Button>
              <Button size="lg" to="/contact" variant="outline">
                <MessageSquare style={{ marginRight: 8, width: 16, height: 16 }} /> Talk to sales
              </Button>
            </div>
          </div>
        </div>
      </Section>
  );
}

export default function Home() {
  // The 3D scene is part of the shared page layout; the hero only needs to know whether it is running.
  const { ready } = useContext(SceneContext);
  return (
    <div style={{ color: c.fg }}>
      <Hero showFallbackRing={!ready} />
      <FeaturesSection />
      <HowItWorksSection />
      <WorkspaceSection />
      <DetailsSection />
      <GithubSection />
      <StatsSection />
      <GuidesSection />
      <FaqSection />
      <CtaSection />
    </div>
  );
}
