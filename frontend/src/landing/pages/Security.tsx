import { motion } from "motion/react";
import { ShieldCheck, Lock, Eye, FileText, Server, RefreshCw, KeyRound, ScrollText } from "lucide-react";
import { Button } from "../components/ui/Button";
import { PageShell, Container, Section, PageHeader, SectionHead, CtaPanel } from "../components/ui/Section";

const pillars = [
  { icon: <Lock size={22} />, title: "Encryption", desc: "AES-256 at rest, TLS 1.3 in transit. Per-tenant keys in the database." },
  { icon: <ShieldCheck size={22} />, title: "Compliance", desc: "SOC2 Type II, GDPR, and CCPA. Annual third-party penetration tests." },
  { icon: <RefreshCw size={22} />, title: "Backups", desc: "Hourly incremental backups across two regions with 30-day PITR." },
  { icon: <Eye size={22} />, title: "Audit logs", desc: "Append-only, queryable, and exportable. Every admin action is recorded." },
  { icon: <Server size={22} />, title: "Hosting", desc: "Production runs on secure cloud infra with 24/7 incident monitoring." },
  { icon: <FileText size={22} />, title: "Data ownership", desc: "You own your data. Export everything in open formats anytime." },
];

const standards = [
  { tag: "SOC 2 Type II", body: "Annual independent audit covering security, availability, and confidentiality." },
  { tag: "GDPR & CCPA", body: "Data-subject rights, deletion, portability, and lawful processing supported." },
  { tag: "ISO 27001-ready", body: "Controls mapped to ISO 27001; certification in progress for 2026." },
  { tag: "Pen-tested", body: "Annual third-party penetration test; reports available on request." },
];

export default function Security() {
  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="Security"
          title={<>Trust is our<br /><span className="text-emerald-600">foundation.</span></>}
          blurb="Enterprise task management involves sensitive data. Taskflow is built with a security-first architecture from day one."
          align="left"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/[0.10] text-emerald-600 text-xs font-medium border border-emerald-500/15 mb-16"
        >
          <ShieldCheck size={14} />
          <span>Secure by design · Reviewed quarterly</span>
        </motion.div>

        <Section pad="tight" className="!py-0 mb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pillars.map((p) => (
              <div key={p.title} className="p-7 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-emerald-500/30 transition-colors space-y-3">
                <div className="size-11 rounded-xl bg-emerald-500/[0.10] text-emerald-600 flex items-center justify-center">
                  {p.icon}
                </div>
                <h3 className="font-semibold tracking-tight text-base">{p.title}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section pad="tight" className="!py-0 mb-20">
          <SectionHead
            eyebrow="Standards"
            title="Certified, audited, and ready for procurement."
            align="left"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {standards.map((s) => (
              <div key={s.tag} className="p-7 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="size-8 rounded-lg bg-brand-primary/[0.08] text-brand-primary flex items-center justify-center">
                    <ScrollText size={16} />
                  </div>
                  <span className="text-sm font-semibold tracking-tight">{s.tag}</span>
                </div>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section pad="tight" className="!py-0 mb-20">
          <SectionHead
            eyebrow="How we protect access"
            title="Zero-trust by default."
            align="left"
          />
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
            {[
              { i: <KeyRound size={18} />, t: "SSO + SCIM", d: "SAML, OIDC, and SCIM provisioning on the Business plan." },
              { i: <Lock size={18} />, t: "Role-based access control", d: "Workspace, project, and field-level permissions." },
              { i: <Eye size={18} />, t: "Row-level security", d: "Postgres RLS enforces org isolation at the database layer." },
              { i: <ShieldCheck size={18} />, t: "Audit-ready logs", d: "Every admin action is appended to an immutable log." },
            ].map((row) => (
              <div key={row.t} className="flex items-start gap-4 p-5">
                <div className="size-9 rounded-lg bg-emerald-500/[0.08] text-emerald-600 flex items-center justify-center shrink-0">
                  {row.i}
                </div>
                <div className="min-w-0">
                  <p className="font-medium tracking-tight">{row.t}</p>
                  <p className="text-sm text-[var(--muted)] leading-relaxed mt-1">{row.d}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <CtaPanel
          title="Have security questions?"
          blurb="Request our security whitepaper or talk to our compliance team about your requirements."
        >
          <Button size="lg" to="/contact">Contact security team</Button>
        </CtaPanel>
      </Container>
    </PageShell>
  );
}
