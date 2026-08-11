import { motion } from "motion/react";
import { PageShell, Container, PageHeader, BRAND, tone, display } from "../lib/ui";

const sections = [
  { title: "1. Acceptance of terms", body: `By creating an account, accessing a workspace, or using any part of the service, you agree to follow these terms. If you are using the platform on behalf of an organization, you confirm that you are authorized to bind that organization.` },
  { title: "2. Service description", body: `Our platform provides cloud-based tools for task management, project planning, team collaboration, and related productivity functions. We may improve, modify, or add features over time.` },
  { title: "3. Account responsibility", body: `You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. We may suspend accounts if we believe they are being used fraudulently.` },
  { title: "4. Content ownership", body: `You retain ownership of your customer data. You grant us a limited right to host, process, and transmit it for the purpose of providing and improving the service.` },
  { title: "5. Prohibited use", body: `You agree not to misuse the platform for unlawful, harmful, or unauthorized purposes. Prohibited activities include attempting to breach security, distributing malware, or reverse engineering the service.` },
  { title: "6. Billing and payments", body: `By subscribing to a paid plan, you authorize us to charge applicable fees. Failure to pay may result in restricted access or suspension of your workspace.` },
  { title: "7. Limitation of liability", body: `To the maximum extent permitted by law, TaskFlow will not be liable for indirect, incidental, or consequential damages arising from your use of the platform.` },
  { title: "8. Signing in with Google", body: `You may create or access your account using Google Sign-In. By doing so, you authorize us to receive your basic Google profile information — your name, email address, and profile picture — for the purpose of authenticating you and identifying you within your workspace. We request only non-sensitive scopes and do not access any other Google service. Our handling of this information is described in our Privacy Policy and complies with the Google API Services User Data Policy.` },
];

export default function Terms() {
  const effectiveDate = "11 August 2026";
  const companyName = "TaskFlow";
  const supportEmail = "info@unimisk.com";

  return (
    <PageShell>
      <Container width={960}>
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

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", gap: 36 }}
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
              Questions about these terms? Contact our support team at{" "}
              <a href={`mailto:${supportEmail}`} style={{ color: BRAND, textDecoration: "underline" }}>
                {supportEmail}
              </a>
              .
            </p>
            <p style={{ margin: 0 }}>
              © {new Date().getFullYear()} {companyName}. All rights reserved.
            </p>
          </div>
        </motion.article>
      </Container>
    </PageShell>
  );
}
