import { motion } from "motion/react";
import { PageShell, Container, PageHeader, BRAND, tone, display } from "../lib/ui";

const sections = [
  {
    title: "Information collection",
    body: `We may collect personal information you directly provide when creating an account, subscribing to a plan, contacting support, booking a demo, joining a waitlist, or submitting forms on our website. This may include name, email, phone number, company name, job title, billing details, workspace name, team information, and any message or file you voluntarily provide while using our task management platform or communicating with our team.`,
  },
  {
    title: "Workspace data",
    body: `When you use our SaaS platform, we collect workspace-related information necessary to provide the service: projects, tasks, comments, attachments, labels, deadlines, priorities, team assignments, workflow settings, activity logs, notification preferences, and integration configurations. We treat this as customer data and use it primarily to operate, improve, secure, and support your workspace.`,
  },
  {
    title: "Usage and technical information",
    body: `We automatically collect certain technical and usage information when you interact with our website or application: IP address, browser type, device details, operating system, referring pages, session duration, pages visited, feature usage, error logs, approximate location, and authentication events.`,
  },
  {
    title: "How we use information",
    body: `We use your personal information to create and manage user accounts, provide access to workspaces, process subscriptions, deliver product features, send notifications, respond to support requests, and improve our services.`,
  },
  {
    title: "Communications",
    body: `We may send you service-related emails such as account verification, password reset, billing alerts, and important administrative announcements. For marketing communications, you may opt out anytime using the unsubscribe link.`,
  },
  {
    title: "Data security",
    body: `We take reasonable technical, organizational, and administrative measures to protect personal information against unauthorized access, loss, misuse, alteration, or disclosure. These measures include encryption in transit and at rest, access controls, and authentication safeguards.`,
  },
];

export default function Privacy() {
  const effectiveDate = "15 May 2026";
  const productName = "Taskflow";
  const supportEmail = "info@unimisk.com";

  return (
    <PageShell>
      <Container width={960}>
        <PageHeader
          eyebrow="Legal"
          title="Privacy Policy"
          blurb={
            <>
              At {productName}, we respect your privacy and are committed to protecting
              the personal information you share with us. · Effective {effectiveDate}.
            </>
          }
          align="left"
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 200px) minmax(0, 1fr)",
            gap: 48,
          }}
        >
          {/* TOC */}
          <aside style={{ display: "none" }}>
            {/* visible via media query handled by parent layout — kept simple */}
          </aside>

          {/* Body */}
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column", gap: 36, gridColumn: "1 / -1" }}
          >
            {sections.map((s, i) => (
              <section
                key={s.title}
                id={`sec-${i}`}
                style={{ display: "flex", flexDirection: "column", gap: 12, scrollMarginTop: 96 }}
              >
                <h2 style={{ ...display, fontSize: 22, fontWeight: 600, margin: 0, color: tone.fg }}>
                  {s.title}
                </h2>
                <p style={{ fontSize: 16, lineHeight: 1.65, color: tone.muted, margin: 0 }}>
                  {s.body}
                </p>
              </section>
            ))}

            <div
              style={{
                paddingTop: 28,
                borderTop: `1px solid ${tone.border}`,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 14,
                color: tone.muted,
              }}
            >
              <p style={{ margin: 0 }}>
                Questions about this policy? Contact us at{" "}
                <a href={`mailto:${supportEmail}`} style={{ color: BRAND, textDecoration: "underline" }}>
                  {supportEmail}
                </a>
                .
              </p>
              <p style={{ margin: 0 }}>
                © {new Date().getFullYear()} {productName}. All rights reserved.
              </p>
            </div>
          </motion.article>
        </div>
      </Container>
    </PageShell>
  );
}
