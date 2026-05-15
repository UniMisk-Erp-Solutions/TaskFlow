import { motion } from "motion/react";
import { Target, Heart, Eye, Rocket, Zap, Shield, Globe2, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";
import {
  PageShell, Container, Section, PageHeader, SectionHead,
  Card, IconBadge, Grid, BRAND, BRAND_ACCENT, tone, display,
} from "../lib/ui";

const timeline = [
  { year: "2024", title: "Founded", body: "Three engineers tired of toggling between five different apps just to finish a sprint." },
  { year: "2025", title: "Beta with 30 teams", body: "Private beta — first lessons on what calmer execution actually looks like." },
  { year: "2025", title: "$4M seed", body: "Raised from operators-turned-investors who use the product daily." },
  { year: "2026", title: "Public launch", body: "Approval workflow, AI assistant, and the timeline you're looking at now." },
];

const values = [
  { icon: <Zap size={20} />, title: "Speed", desc: "We ship fast and help our customers do the same." },
  { icon: <Shield size={20} />, title: "Trust", desc: "Security and data integrity are non-negotiable." },
  { icon: <Heart size={20} />, title: "Clarity", desc: "Simple, honest communication in everything." },
  { icon: <Rocket size={20} />, title: "Growth", desc: "Always learning, iterating, pushing the boundary." },
];

const stats = [
  { v: "40+", l: "Teammates" },
  { v: "12", l: "Countries" },
  { v: "50k+", l: "Active teams" },
  { v: "100%", l: "Remote-first" },
];

export default function About() {
  return (
    <PageShell>
      <Container>
        <PageHeader
          eyebrow="About"
          title={
            <>
              On a mission to kill
              <br />
              <span style={{ color: BRAND }}>workflow clutter.</span>
            </>
          }
          blurb="Teams do their best work when responsibilities are clear, deadlines are visible, and progress is easy to understand."
        />

        {/* Mission / Vision */}
        <Grid min={320} gap={20} style={{ marginBottom: 96 }}>
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 20,
              border: `1px solid ${tone.border}`,
              background: tone.card,
              padding: 36,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -96,
                right: -96,
                width: 240,
                height: 240,
                background: `${BRAND}26`,
                borderRadius: 999,
                filter: "blur(60px)",
              }}
            />
            <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
              <IconBadge>
                <Target size={22} />
              </IconBadge>
              <h3 style={{ ...display, fontSize: 22, fontWeight: 600, margin: 0, color: tone.fg }}>
                Our mission
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: tone.muted, margin: 0 }}>
                Empower every organization with a workspace that fosters accountability
                and execution speed through radical clarity.
              </p>
            </div>
          </div>
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 20,
              border: `1px solid ${tone.border}`,
              background: tone.card,
              padding: 36,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -96,
                left: -96,
                width: 240,
                height: 240,
                background: `${BRAND_ACCENT}26`,
                borderRadius: 999,
                filter: "blur(60px)",
              }}
            />
            <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
              <IconBadge tint={BRAND_ACCENT}>
                <Eye size={22} />
              </IconBadge>
              <h3 style={{ ...display, fontSize: 22, fontWeight: 600, margin: 0, color: tone.fg }}>
                Our vision
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: tone.muted, margin: 0 }}>
                Build the operating system for modern business — where every decision,
                file, and milestone is connected to the work it belongs to.
              </p>
            </div>
          </div>
        </Grid>

        {/* Stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 24,
            borderTop: `1px solid ${tone.border}`,
            borderBottom: `1px solid ${tone.border}`,
            padding: "40px 0",
            marginBottom: 96,
            textAlign: "center",
          }}
        >
          {stats.map((s) => (
            <div key={s.l} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{ ...display, fontSize: 36, fontWeight: 600, margin: 0, color: tone.fg }}>
                {s.v}
              </p>
              <p style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: tone.muted, margin: 0 }}>
                {s.l}
              </p>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <Section pad="tight" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
          <SectionHead eyebrow="Timeline" title="The short history." />
          <ol
            style={{
              maxWidth: 720,
              margin: "0 auto",
              listStyle: "none",
              padding: 0,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 40,
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 19,
                top: 12,
                bottom: 12,
                width: 1,
                background: tone.border,
              }}
            />
            {timeline.map((e) => (
              <li key={e.year + e.title} style={{ position: "relative", paddingLeft: 56 }}>
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: tone.card,
                    border: `1px solid ${tone.border}`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    color: BRAND,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {e.year.slice(-2)}
                </span>
                <h3 style={{ ...display, fontSize: 17, fontWeight: 600, margin: 0, color: tone.fg }}>
                  {e.title}
                </h3>
                <p style={{ fontSize: 14, marginTop: 6, color: tone.muted, lineHeight: 1.6 }}>{e.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Values */}
        <Section pad="tight" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
          <SectionHead eyebrow="Values" title="What we believe in." />
          <Grid min={220} gap={20}>
            {values.map((v) => (
              <Card key={v.title}>
                <IconBadge>{v.icon}</IconBadge>
                <h4 style={{ ...display, fontSize: 17, fontWeight: 600, margin: 0, color: tone.fg }}>
                  {v.title}
                </h4>
                <p style={{ fontSize: 14, color: tone.muted, marginTop: 6, lineHeight: 1.6 }}>{v.desc}</p>
              </Card>
            ))}
          </Grid>
        </Section>

        {/* Careers CTA */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            background: "#020617",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 24,
            padding: "64px 32px",
            textAlign: "center",
            boxShadow: "0 40px 80px -40px rgba(15,23,42,0.4)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -96,
              right: -96,
              width: 320,
              height: 320,
              background: `${BRAND}26`,
              borderRadius: 999,
              filter: "blur(80px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -96,
              left: -96,
              width: 320,
              height: 320,
              background: `${BRAND_ACCENT}26`,
              borderRadius: 999,
              filter: "blur(80px)",
            }}
          />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: BRAND,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={22} />
            </div>
            <h2 style={{ ...display, fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600, lineHeight: 1.1, margin: 0, color: "white" }}>
              Join the journey.
            </h2>
            <p style={{ fontSize: 17, color: "#94a3b8", maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
              Remote-first, async by default. We're hiring across engineering, design, and customer success.
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "center",
                alignItems: "center",
                fontSize: 13,
                color: "#94a3b8",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Globe2 size={14} /> 12 countries
              </span>
              <span>·</span>
              <span>4-day workweek</span>
              <span>·</span>
              <span>$5k learning budget</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
              <Button size="lg" to="/contact">Explore careers</Button>
            </div>
          </div>
        </div>
      </Container>
    </PageShell>
  );
}
