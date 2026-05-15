import { motion } from "motion/react";
import { PageShell, Container, PageHeader } from "../components/ui/Section";

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
      <Container width="5xl">
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

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-12">
          {/* Sticky TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-2 text-sm">
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--muted)] mb-4">Contents</p>
              {sections.map((s, i) => (
                <a
                  key={s.title}
                  href={`#sec-${i}`}
                  className="block text-[var(--muted)] hover:text-brand-primary transition-colors py-1"
                >
                  {s.title}
                </a>
              ))}
            </div>
          </aside>

          {/* Body */}
          <motion.article
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-10 text-[var(--foreground)] leading-relaxed"
          >
            {sections.map((s, i) => (
              <section key={s.title} id={`sec-${i}`} className="space-y-3 scroll-mt-28">
                <h2 className="font-display text-2xl font-semibold tracking-tight">{s.title}</h2>
                <p className="text-[var(--muted)]">{s.body}</p>
              </section>
            ))}

            <div className="pt-8 border-t border-[var(--border)] space-y-1.5 text-sm text-[var(--muted)]">
              <p>
                Questions about this policy? Contact us at{" "}
                <a href={`mailto:${supportEmail}`} className="text-brand-primary hover:underline">
                  {supportEmail}
                </a>.
              </p>
              <p>© {new Date().getFullYear()} {productName}. All rights reserved.</p>
            </div>
          </motion.article>
        </div>
      </Container>
    </PageShell>
  );
}
