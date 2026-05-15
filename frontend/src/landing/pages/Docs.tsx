import { motion } from "motion/react";
import {
  Search, Users, Layout, Zap, Settings, HelpCircle, BookOpen,
  Activity, Calendar, Bot, Shield, ArrowRight,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import {
  PageShell, Container, Section, PageHeader, SectionHead,
  Card, Grid, CtaPanel, BRAND, tone, display,
} from "../lib/ui";

const quickStart = [
  { title: "Workspace setup", icon: <Settings size={18} />, description: "Configure your team's main workspace in under five minutes." },
  { title: "Project planning", icon: <Layout size={18} />, description: "Build and manage project workflows that survive scope changes." },
  { title: "Task management", icon: <Zap size={18} />, description: "Creating, assigning, and tracking work — the right way." },
  { title: "Team collaboration", icon: <Users size={18} />, description: "Mention teammates and manage discussions in context." },
];

const categories = [
  { title: "Getting started", icon: <BookOpen size={18} />, articles: ["Create your workspace", "Invite teammates", "Your first project", "Connect calendars"] },
  { title: "Tasks & projects", icon: <Layout size={18} />, articles: ["Subtasks and dependencies", "Multiple assignees", "Due dates with time", "Status and priority"] },
  { title: "Approval workflow", icon: <Activity size={18} />, articles: ["Submit for review", "Approving work", "Requesting changes", "Reading the history timeline"] },
  { title: "Calendar & timeline", icon: <Calendar size={18} />, articles: ["Switching views", "Rescheduling tasks", "Sharing a public calendar", "Time zones"] },
  { title: "AI assistant", icon: <Bot size={18} />, articles: ["Asking grounded questions", "Generating status reports", "Smart scheduling", "Privacy boundaries"] },
  { title: "Admin & security", icon: <Shield size={18} />, articles: ["SSO setup", "Role-based access", "Audit logs", "Data export"] },
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
        <div style={{ maxWidth: 560, margin: "0 auto 64px", position: "relative" }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              color: tone.muted,
            }}
          />
          <input
            type="text"
            placeholder="Search documentation…"
            style={{
              width: "100%",
              padding: "14px 16px 14px 44px",
              borderRadius: 16,
              border: `1px solid ${tone.border}`,
              background: tone.card,
              color: tone.fg,
              fontSize: 14,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Quick start */}
        <Section pad="tight" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
          <SectionHead eyebrow="Quick start" title="Start here." align="left" />
          <Grid min={240} gap={20}>
            {quickStart.map((s, idx) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: `${BRAND}14`, color: BRAND,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 16,
                    }}
                  >
                    {s.icon}
                  </div>
                  <h3 style={{ ...display, fontSize: 15, fontWeight: 600, margin: "0 0 6px", color: tone.fg }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize: 13, color: tone.muted, lineHeight: 1.55, margin: 0 }}>
                    {s.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </Grid>
        </Section>

        {/* Categories */}
        <Section pad="tight" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
          <SectionHead eyebrow="Topics" title="Browse by category." align="left" />
          <Grid min={280} gap={20}>
            {categories.map((cat) => (
              <Card key={cat.title}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `${BRAND}14`, color: BRAND,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {cat.icon}
                  </div>
                  <h3 style={{ ...display, fontSize: 16, fontWeight: 600, margin: 0, color: tone.fg }}>
                    {cat.title}
                  </h3>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {cat.articles.map((a) => (
                    <li key={a}>
                      <a
                        href="#"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 14,
                          color: tone.muted,
                          textDecoration: "none",
                        }}
                      >
                        <ArrowRight size={12} style={{ opacity: 0.5 }} />
                        {a}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </Grid>
        </Section>

        <CtaPanel
          title={
            <>
              <HelpCircle style={{ display: "inline-block", marginRight: 10, marginTop: -4, verticalAlign: "middle" }} /> Still need help?
            </>
          }
          blurb="If the docs don't answer your question, contact support with your workspace name and a clear description of the issue."
        >
          <Button size="lg" to="/contact">Contact support</Button>
          <a
            href={`mailto:${supportEmail}`}
            style={{ fontSize: 14, color: "#94a3b8", textDecoration: "none", padding: "0 12px" }}
          >
            or email {supportEmail}
          </a>
        </CtaPanel>
      </Container>
    </PageShell>
  );
}
