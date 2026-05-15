import { motion } from "motion/react";
import { ShieldCheck, Lock, Eye, FileText, Server, RefreshCw, KeyRound, ScrollText } from "lucide-react";
import { Button } from "../components/ui/Button";
import {
  PageShell, Container, Section, PageHeader, SectionHead,
  Card, Grid, CtaPanel, BRAND, tone, display,
} from "../lib/ui";

const EMERALD = "#10b981";

const pillars = [
  { icon: <Lock size={22} />, title: "Encryption", desc: "AES-256 at rest, TLS 1.3 in transit. Per-tenant keys in the database." },
  { icon: <ShieldCheck size={22} />, title: "Compliance", desc: "SOC2 Type II compliant and follows GDPR / CCPA. Annual third-party pen tests." },
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

const accessRows = [
  { i: <KeyRound size={18} />, t: "SSO + SCIM", d: "SAML, OIDC, and SCIM provisioning on the Business plan." },
  { i: <Lock size={18} />, t: "Role-based access control", d: "Workspace, project, and field-level permissions." },
  { i: <Eye size={18} />, t: "Row-level security", d: "Postgres RLS enforces org isolation at the database layer." },
  { i: <ShieldCheck size={18} />, t: "Audit-ready logs", d: "Every admin action is appended to an immutable log." },
];

export default function Security() {
  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="Security"
          title={
            <>
              Trust is our
              <br />
              <span style={{ color: EMERALD }}>foundation.</span>
            </>
          }
          blurb="Enterprise task management involves sensitive data. Taskflow is built with a security-first architecture from day one."
          align="left"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 999,
            background: `${EMERALD}1A`,
            color: EMERALD,
            border: `1px solid ${EMERALD}33`,
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 64,
          }}
        >
          <ShieldCheck size={14} />
          Secure by design · Reviewed quarterly
        </motion.div>

        {/* Pillars */}
        <Grid min={280} gap={20} style={{ marginBottom: 80 }}>
          {pillars.map((p) => (
            <Card key={p.title}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${EMERALD}1A`, color: EMERALD,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                {p.icon}
              </div>
              <h3 style={{ ...display, fontSize: 17, fontWeight: 600, margin: "0 0 8px", color: tone.fg }}>
                {p.title}
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: tone.muted, margin: 0 }}>{p.desc}</p>
            </Card>
          ))}
        </Grid>

        {/* Standards */}
        <Section pad="tight" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
          <SectionHead
            eyebrow="Standards"
            title="Certified, audited, and ready for procurement."
            align="left"
          />
          <Grid min={300} gap={16}>
            {standards.map((s) => (
              <Card key={s.tag}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: 10,
                      background: `${BRAND}14`, color: BRAND,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <ScrollText size={16} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", color: tone.fg }}>
                    {s.tag}
                  </span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: tone.muted, margin: 0 }}>{s.body}</p>
              </Card>
            ))}
          </Grid>
        </Section>

        {/* Access list */}
        <Section pad="tight" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
          <SectionHead
            eyebrow="How we protect access"
            title="Zero-trust by default."
            align="left"
          />
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${tone.border}`,
              background: tone.card,
              overflow: "hidden",
            }}
          >
            {accessRows.map((row, i) => (
              <div
                key={row.t}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                  padding: 20,
                  borderTop: i === 0 ? "none" : `1px solid ${tone.border}`,
                }}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${EMERALD}14`, color: EMERALD,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {row.i}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em", color: tone.fg, margin: 0 }}>
                    {row.t}
                  </p>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: tone.muted, marginTop: 4 }}>{row.d}</p>
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
