import { motion } from "motion/react";
import { PageShell, Container, PageHeader } from "../components/ui/Section";

const sections = [
  {
    title: "1. Acceptance of terms",
    body: `By creating an account, accessing a workspace, or using any part of the service, you agree to follow these terms. If you are using the platform on behalf of an organization, you confirm that you are authorized to bind that organization.`,
  },
  {
    title: "2. Service description",
    body: `Our platform provides cloud-based tools for task management, project planning, team collaboration, and related productivity functions. We may improve, modify, or add features over time.`,
  },
  {
    title: "3. Account responsibility",
    body: `You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. We may suspend accounts if we believe they are being used fraudulently.`,
  },
  {
    title: "4. Content ownership",
    body: `You retain ownership of your customer data. You grant us a limited right to host, process, and transmit it for the purpose of providing and improving the service.`,
  },
  {
    title: "5. Prohibited use",
    body: `You agree not to misuse the platform for unlawful, harmful, or unauthorized purposes. Prohibited activities include attempting to breach security, distributing malware, or reverse engineering the service.`,
  },
  {
    title: "6. Billing and payments",
    body: `By subscribing to a paid plan, you authorize us to charge applicable fees. Failure to pay may result in restricted access or suspension of your workspace.`,
  },
  {
    title: "7. Limitation of liability",
    body: `To the maximum extent permitted by law, Taskflow will not be liable for indirect, incidental, or consequential damages arising from your use of the platform.`,
  },
];

export default function Terms() {
  const effectiveDate = "15 May 2026";
  const companyName = "Taskflow";
  const supportEmail = "info@unimisk.com";

  return (
    <PageShell>
      <Container width="5xl">
        <PageHeader
          eyebrow="Legal"
          title="Terms & Conditions"
          blurb={
            <>
              These Terms and Conditions govern your access to and use of {companyName},
              including our website and applications. · Effective {effectiveDate}.
            </>
          }
          align="left"
        />

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-12">
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
                Questions about these terms? Contact our support team at{" "}
                <a href={`mailto:${supportEmail}`} className="text-brand-primary hover:underline">
                  {supportEmail}
                </a>.
              </p>
              <p>© {new Date().getFullYear()} {companyName}. All rights reserved.</p>
            </div>
          </motion.article>
        </div>
      </Container>
    </PageShell>
  );
}
