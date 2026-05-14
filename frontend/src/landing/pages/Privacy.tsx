import { motion } from "motion/react";

export default function Privacy() {
  const effectiveDate = "15/5/2026";
  const companyName = "Taskflow";
  const productName = "Taskflow";
  const supportEmail = "info@unimisk.com";

  return (
    <div className="pt-32 pb-20 px-6">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-5xl font-bold"
          >
            Privacy Policy
          </motion.h1>
          <p className="text-sm text-[var(--muted)]">Effective Date: {effectiveDate}</p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-[var(--foreground)] leading-relaxed">
          <p className="text-lg font-medium text-brand-primary">
            At {productName}, we respect your privacy and are committed to protecting the personal information you share with us.
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Information Collection</h2>
            <p>
              We may collect personal information that you directly provide when creating an account, subscribing to a plan, 
              contacting support, booking a demo, joining a waitlist, or submitting forms on our website. This information 
              may include your name, email address, phone number, company name, job title, billing details, workspace name, 
              team information, and any message or file you voluntarily provide while using our task management platform 
              or communicating with our team.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Workspace Data</h2>
            <p>
              When you use our SaaS platform, we may collect workspace-related information necessary to provide the service. 
              This can include projects, tasks, comments, attachments, labels, deadlines, priorities, team assignments, 
              workflow settings, activity logs, notification preferences, and integration configurations. We treat this 
              information as customer data and use it primarily to operate, improve, secure, and support your workspace.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Usage and Technical Information</h2>
            <p>
              We automatically collect certain technical and usage information when you interact with our website or application. 
              This may include your IP address, browser type, device details, operating system, referring pages, session duration, 
              pages visited, feature usage, error logs, approximate location, and authentication events.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">How We Use Information</h2>
            <p>
              We use your personal information to create and manage user accounts, provide access to workspaces, process 
              subscriptions, deliver product features, send notifications, respond to support requests, and improve our services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Communications</h2>
            <p>
              We may send you service-related emails such as account verification, password reset messages, billing alerts, 
              and important administrative announcements. For marketing communications, you may opt out anytime using 
              the unsubscribe link.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Data Security</h2>
            <p>
              We take reasonable technical, organizational, and administrative measures to protect personal information 
              against unauthorized access, loss, misuse, alteration, or disclosure. These measures may include 
              encryption in transit, access controls, and authentication safeguards.
            </p>
          </section>

          <div className="pt-8 border-t border-[var(--border)]">
            <p className="text-sm text-[var(--muted)]">
              If you have any questions about this policy, please contact us at <span className="text-brand-primary">{supportEmail}</span>.
            </p>
            <p className="text-sm text-[var(--muted)] mt-2">© {new Date().getFullYear()} {companyName}. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
