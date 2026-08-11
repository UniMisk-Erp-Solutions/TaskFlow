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
    title: "Signing in with Google",
    body: `If you choose "Continue with Google", we use Google Sign-In (OAuth 2.0) to authenticate you. Google shares with us only your basic profile information — your name, email address, and profile picture — which we use solely to create and sign in to your TaskFlow account and to identify you within your workspace. We request only the non-sensitive "email", "profile", and "openid" scopes; we do not request or receive access to your Gmail, Google Drive, Google Calendar, Google Contacts, or any other Google service. TaskFlow's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We never sell Google user data and never use it for advertising. You can review or revoke TaskFlow's access at any time at https://myaccount.google.com/permissions.`,
  },
  {
    title: "Data sharing and disclosure",
    body: `We do not sell your personal information or Google user data. We share information only with service providers that help us operate the platform (such as hosting and infrastructure) under confidentiality obligations, or when required by law. We do not transfer Google user data to third parties except as necessary to provide or improve the service, for security, or to comply with applicable law.`,
  },
  {
    title: "Data retention and deletion",
    body: `We retain your personal and workspace information for as long as your account is active. A workspace administrator can remove a user at any time, which deletes that user's profile and any Google Sign-In association. You may also request deletion of your account and associated personal data by emailing us at the address below; we will delete it within a reasonable period, except where retention is required by law.`,
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
  const effectiveDate = "11 August 2026";
  const productName = "TaskFlow";
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
