import { motion } from "motion/react";

export default function Terms() {
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
            Terms & Conditions
          </motion.h1>
          <p className="text-sm text-[var(--muted)]">Effective Date: {effectiveDate}</p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-[var(--foreground)] leading-relaxed">
          <p className="text-lg font-medium text-brand-primary">
            These Terms and Conditions govern your access to and use of {productName}, including our website and applications.
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">1. Acceptance of Terms</h2>
            <p>
              By creating an account, accessing a workspace, or using any part of the service, you agree to follow these 
              terms. If you are using the platform on behalf of an organization, you confirm that you are authorized 
              to bind that organization.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">2. Service Description</h2>
            <p>
              Our platform provides cloud-based tools for task management, project planning, team collaboration, and 
              related productivity functions. We may improve, modify, or add features over time.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">3. Account Responsibility</h2>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and for all activity 
              that occurs under your account. We may suspend accounts if we believe they are being used fraudulently.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">4. Content Ownership</h2>
            <p>
              You retain ownership of your customer data. You grant us a limited right to host, process, and transmit 
              it for the purpose of providing and improving the service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">5. Prohibited Use</h2>
            <p>
              You agree not to misuse the platform for unlawful, harmful, or unauthorized purposes. Prohibited 
              activities include attempting to breach security, distributing malware, or reverse engineering the service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">6. Billing and Payments</h2>
            <p>
              By subscribing to a paid plan, you authorize us to charge applicable fees. Failure to pay may 
              result in restricted access or suspension of your workspace.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, {companyName} will not be liable for indirect, incidental, or 
              consequential damages arising from your use of the platform.
            </p>
          </section>

          <div className="pt-8 border-t border-[var(--border)]">
            <p className="text-sm text-[var(--muted)]">
              For questions regarding these terms, please contact our support team at <span className="text-brand-primary">{supportEmail}</span>.
            </p>
            <p className="text-sm text-[var(--muted)] mt-2">© {new Date().getFullYear()} {companyName}. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
