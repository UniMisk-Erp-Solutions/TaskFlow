import { motion } from "motion/react";
import { Send, MapPin, Mail, MessageSquare, Clock } from "lucide-react";
import { Button } from "../components/ui/Button";
import { PageShell, Container, Eyebrow, BRAND, tone, display } from "../lib/ui";

const contacts = [
  { icon: <Mail size={18} />, label: "Email us", value: "hello@taskflow.app", tint: BRAND },
  { icon: <MessageSquare size={18} />, label: "Live support", value: "Mon–Fri · 9am – 6pm EST", tint: "#10b981" },
  { icon: <Clock size={18} />, label: "Response time", value: "Under 4 business hours", tint: "#f59e0b" },
  { icon: <MapPin size={18} />, label: "Office", value: "123 Innovation Way, SF, CA 94105", tint: "#f43f5e" },
];

function Field({ label, placeholder, type = "text" }: { label: string; placeholder: string; type?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.01em", color: tone.fg }}>
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          border: `1px solid ${tone.border}`,
          background: tone.bg,
          color: tone.fg,
          fontSize: 14,
          outline: "none",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}

export default function Contact() {
  return (
    <PageShell>
      <Container>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 48,
            alignItems: "start",
          }}
        >
          {/* Left — info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Eyebrow>Contact</Eyebrow>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  ...display,
                  fontSize: "clamp(36px, 5vw, 56px)",
                  fontWeight: 600,
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  margin: 0,
                  color: tone.fg,
                }}
              >
                Let's talk.
              </motion.h1>
              <p style={{ fontSize: 17, lineHeight: 1.6, color: tone.muted, margin: 0 }}>
                Whether you have a question about features, pricing, or a professional
                demo, our team is ready to help.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {contacts.map((c) => (
                <div
                  key={c.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: 16,
                    borderRadius: 16,
                    border: `1px solid ${tone.border}`,
                    background: tone.card,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: `${c.tint}1A`,
                      color: c.tint,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {c.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: tone.muted, margin: 0, letterSpacing: "-0.01em" }}>
                      {c.label}
                    </p>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        letterSpacing: "-0.01em",
                        color: tone.fg,
                        margin: "2px 0 0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div
              style={{
                borderRadius: 24,
                border: `1px solid ${tone.border}`,
                background: tone.card,
                padding: 36,
                boxShadow: "0 24px 48px -24px rgba(15,23,42,0.12)",
              }}
            >
              <form
                onSubmit={(e) => e.preventDefault()}
                style={{ display: "flex", flexDirection: "column", gap: 20 }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 16,
                  }}
                >
                  <Field label="First name" placeholder="Jane" />
                  <Field label="Last name" placeholder="Doe" />
                </div>
                <Field label="Work email" placeholder="jane@company.com" type="email" />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.01em", color: tone.fg }}>
                    Company size
                  </label>
                  <select
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: `1px solid ${tone.border}`,
                      background: tone.bg,
                      color: tone.fg,
                      fontSize: 14,
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  >
                    <option>1–10 employees</option>
                    <option>11–50 employees</option>
                    <option>51–200 employees</option>
                    <option>201–1,000 employees</option>
                    <option>1,000+ employees</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.01em", color: tone.fg }}>
                    Message
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Tell us about your team's needs…"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: `1px solid ${tone.border}`,
                      background: tone.bg,
                      color: tone.fg,
                      fontSize: 14,
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                <Button className="w-full" size="lg">
                  Send message <Send style={{ marginLeft: 8, width: 16, height: 16 }} />
                </Button>
                <p style={{ fontSize: 12, color: tone.muted, textAlign: "center", lineHeight: 1.5, margin: 0 }}>
                  By submitting, you agree to our{" "}
                  <a href="/privacy" style={{ color: BRAND, textDecoration: "underline" }}>
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a href="/terms" style={{ color: BRAND, textDecoration: "underline" }}>
                    Terms
                  </a>
                  .
                </p>
              </form>
            </div>
          </motion.div>
        </div>
      </Container>
    </PageShell>
  );
}
