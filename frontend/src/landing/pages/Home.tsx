import type { ReactNode, CSSProperties } from "react";
import { motion } from "motion/react";
import {
  ArrowRight, Zap, Shield, Users, BarChart3, Clock, Sparkles,
  CheckCircle2, MessageSquare, Star,
} from "lucide-react";
import { Button } from "../components/ui/Button";

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

const features = [
  { icon: <Zap size={20} />, title: "Real-time sync", desc: "Collaborate with your team in real-time with instant updates across every device." },
  { icon: <Users size={20} />, title: "Team management", desc: "Manage roles, permissions, and workload distribution with intuitive controls." },
  { icon: <Shield size={20} />, title: "Enterprise security", desc: "Bank-grade encryption and advanced security protocols protect your data." },
  { icon: <BarChart3 size={20} />, title: "Advanced reports", desc: "Deep insight into productivity, completion rates, and project health." },
  { icon: <Clock size={20} />, title: "Timeline view", desc: "Plan projects with visual timelines and manage dependencies effortlessly." },
  { icon: <Sparkles size={20} />, title: "AI automation", desc: "Let our AI handle repetitive tasks, summaries, and smart scheduling." },
];

const steps = [
  { n: "01", icon: <Users size={20} />, title: "Bring the team in", desc: "Invite teammates, set roles, and group work into projects in under a minute." },
  { n: "02", icon: <Zap size={20} />, title: "Plan & assign", desc: "Break work into tasks, set priorities and dependencies. Drag, schedule, repeat." },
  { n: "03", icon: <CheckCircle2 size={20} />, title: "Submit & approve", desc: "Employees submit for review with notes. Admins approve or reopen — all logged." },
];

const stats = [
  { v: "98%", l: "Satisfaction" },
  { v: "1.2M+", l: "Tasks monthly" },
  { v: "50k+", l: "Teams" },
  { v: "<2s", l: "Median load" },
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
    <section style={{ padding: "80px 24px", background: c.bg, ...style }}>
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
    <div style={{
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
    </div>
  );
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: c.card,
      border: `1px solid ${c.border}`,
      borderRadius: 16,
      padding: 28,
      ...style,
    }}>
      {children}
    </div>
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
export default function Home() {
  return (
    <div style={{ background: c.bg, color: c.fg }}>
      {/* ─── HERO ──────────────────────────────────────────────────────── */}
      <section style={{
        position: "relative",
        overflow: "hidden",
        background: c.bg,
        padding: "128px 24px 80px",
      }}>
        <div style={{
          position: "absolute", inset: 0, top: 0, height: 640,
          background: `radial-gradient(60% 50% at 50% 0%, ${PRIMARY}26 0%, transparent 70%)`,
          pointerEvents: "none", zIndex: 0,
        }} />
        <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto", textAlign: "center" }}>
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 12px", borderRadius: 999,
              background: `${PRIMARY}14`, color: PRIMARY,
              border: `1px solid ${PRIMARY}33`,
              fontSize: 12, fontWeight: 500, letterSpacing: "-0.01em",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: PRIMARY }} />
            New · AI workflow automation
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            style={{
              ...display,
              fontSize: "clamp(40px, 7vw, 76px)",
              fontWeight: 600,
              lineHeight: 1.05,
              margin: "32px 0 24px",
              color: c.fg,
              letterSpacing: "-0.035em",
            }}
          >
            The execution workspace<br />
            <span style={{ color: PRIMARY }}>for teams that move fast.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{
              fontSize: 18, lineHeight: 1.65, color: c.muted,
              maxWidth: 640, margin: "0 auto 40px",
            }}
          >
            Plan, assign, and ship work without the friction. One calm workspace
            for tasks, meetings, and the people who get them done.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{
              display: "flex", flexWrap: "wrap", gap: 12,
              justifyContent: "center", alignItems: "center",
            }}
          >
            <Button size="lg" to="/login?mode=signup">
              Start free <ArrowRight style={{ marginLeft: 8, width: 16, height: 16 }} />
            </Button>
            <Button variant="outline" size="lg" to="/features">
              See how it works
            </Button>
          </motion.div>

          <div style={{
            marginTop: 28,
            display: "flex", flexWrap: "wrap", justifyContent: "center",
            gap: 24, fontSize: 12, color: c.muted,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={14} color="#10b981" /> No credit card
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={14} color="#10b981" /> 14-day Pro trial
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={14} color="#10b981" /> Cancel anytime
            </span>
          </div>

          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7 }}
            style={{ marginTop: 72 }}
          >
            <div style={{
              borderRadius: 16,
              border: `1px solid ${c.border}`,
              background: c.card,
              boxShadow: "0 30px 80px -30px rgba(15,23,42,0.25)",
              overflow: "hidden",
              textAlign: "left",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 16px", borderBottom: `1px solid ${c.border}`,
                background: `${c.bg}99`,
              }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "#ef4444aa" }} />
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "#f59e0baa" }} />
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "#10b981aa" }} />
                <span style={{ marginLeft: 12, fontSize: 11, color: c.muted, fontFamily: "monospace" }}>
                  app.taskflow.io / projects
                </span>
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16, padding: 24,
              }}>
                {[
                  { title: "Backlog", dot: "#94a3b8", items: ["Update brand guidelines", "Audit landing copy"] },
                  { title: "In Progress", dot: PRIMARY, items: ["Launch announcement", "API documentation refresh"] },
                  { title: "Done", dot: "#10b981", items: ["Q2 retrospective", "Onboarding videos"] },
                ].map((col) => (
                  <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: col.dot }} />
                      <p style={{
                        fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
                        textTransform: "uppercase", color: c.muted, margin: 0,
                      }}>{col.title}</p>
                    </div>
                    {col.items.map((t) => (
                      <div key={t} style={{
                        padding: 12, borderRadius: 12,
                        border: `1px solid ${c.border}`,
                        background: `${c.bg}99`,
                      }}>
                        <p style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: c.fg, margin: 0 }}>{t}</p>
                        <div style={{
                          marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                          <span style={{ fontSize: 11, color: c.muted }}>Due Aug 24</span>
                          <div style={{ width: 16, height: 16, borderRadius: 999, background: `${PRIMARY}4D` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── LOGO BAR ──────────────────────────────────────────────────── */}
      <section style={{
        background: c.bg, borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}`,
        padding: "48px 24px",
      }}>
        <div style={{
          maxWidth: 1120, margin: "0 auto",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
        }}>
          <p style={{
            fontSize: 11, fontWeight: 500, letterSpacing: "0.18em",
            textTransform: "uppercase", color: c.muted, margin: 0,
          }}>Trusted by teams at</p>
          <div style={{
            display: "flex", flexWrap: "wrap", justifyContent: "center",
            gap: "16px 48px",
            fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em",
            color: c.muted, opacity: 0.7,
          }}>
            <span>LAYER</span>
            <span>QUARTZ</span>
            <span>NOTION</span>
            <span>VELOCITY</span>
            <span>FORGE</span>
            <span>ATLAS</span>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─────────────────────────────────────────────────── */}
      <Section>
        <SectionHead
          eyebrow="What's inside"
          title={<>Everything teams need.<br /><span style={{ color: c.muted }}>Nothing they don't.</span></>}
          blurb="Calm, focused, and built on real workflow primitives — not feature checklists."
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

      {/* ─── HOW IT WORKS ─────────────────────────────────────────────── */}
      <Section style={{ borderTop: `1px solid ${c.border}` }}>
        <SectionHead
          eyebrow="How it works"
          title={<>From scattered to shipped<br />in three calm steps.</>}
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

      {/* ─── TESTIMONIAL ──────────────────────────────────────────────── */}
      <Section>
        <figure style={{
          maxWidth: 840, margin: "0 auto",
          textAlign: "center", display: "flex", flexDirection: "column", gap: 24, alignItems: "center",
        }}>
          <div style={{ display: "flex", gap: 4, color: "#fbbf24" }}>
            {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={16} fill="currentColor" strokeWidth={0} />)}
          </div>
          <blockquote style={{
            ...display, fontSize: "clamp(20px, 2.5vw, 28px)", fontWeight: 500,
            lineHeight: 1.35, color: c.fg, margin: 0, fontStyle: "normal",
          }}>
            “We replaced three tools with Taskflow. The submit-and-approve flow
            alone saves our leads half a day a week — and our team finally stopped
            asking ‘where do we track this again?’”
          </blockquote>
          <figcaption style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: `${PRIMARY}33` }} />
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: c.fg, letterSpacing: "-0.01em" }}>Maya Patel</p>
              <p style={{ fontSize: 12, color: c.muted, margin: "2px 0 0" }}>Head of Operations · Quartz</p>
            </div>
          </figcaption>
        </figure>
      </Section>

      {/* ─── STATS ────────────────────────────────────────────────────── */}
      <section style={{
        background: "#020617", color: "white", padding: "72px 24px",
        position: "relative", overflow: "hidden",
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
          {stats.map((s) => (
            <div key={s.l} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{
                ...display, fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 600, margin: 0,
              }}>{s.v}</p>
              <p style={{
                fontSize: 11, color: "#94a3b8", margin: 0,
                letterSpacing: "0.12em", textTransform: "uppercase",
              }}>{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────── */}
      <Section>
        <div style={{
          position: "relative", overflow: "hidden",
          background: "#020617",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 24, padding: "64px 32px",
          textAlign: "center",
          boxShadow: "0 40px 80px -40px rgba(15,23,42,0.4)",
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
              lineHeight: 1.1, margin: 0, color: "white",
            }}>Bring calm to your team’s work.</h2>
            <p style={{
              fontSize: 17, lineHeight: 1.6, color: "#94a3b8",
              maxWidth: 520, margin: 0,
            }}>
              Free forever for small teams. No credit card required to start.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 12 }}>
              <Button size="lg" to="/login?mode=signup">Get started free</Button>
              <Button
                size="lg" to="/contact" variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                <MessageSquare style={{ marginRight: 8, width: 16, height: 16 }} /> Talk to sales
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
