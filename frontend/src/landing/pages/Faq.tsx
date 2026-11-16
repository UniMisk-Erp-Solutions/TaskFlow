import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "../components/ui/Button";
import { PageShell, Container, PageHeader, tone, display } from "../lib/ui";
import { FAQ_GROUPS, faqPath } from "../../seo/faqContent.js";
import PageLinks from "../components/PageLinks";

/**
 * Full FAQ list. Every question is a link to its own page (see FaqQuestion.tsx), where the answer is shown in full.
 * The home page keeps its own short list of accordions.
 */
export default function Faq() {
  return (
    <PageShell>
      <style>{".tf-faq-row{transition:background .15s}.tf-faq-row:hover{background:var(--accent)}.tf-faq-row:hover svg{transform:translateX(3px)}.tf-faq-row svg{transition:transform .15s}.tf-faq-row:focus-visible{outline:2px solid #8B5CF6;outline-offset:-2px;border-radius:6px}"}</style>
      <Container width={820}>
        <PageHeader
          eyebrow="FAQ"
          title="TaskFlow FAQ"
          blurb="Straight answers about what TaskFlow does, how plans work and how to get started. Pick a question to read its answer."
        />

        {FAQ_GROUPS.map((group, g) => (
          <section key={group.title} aria-labelledby={`faq-group-${g}`} style={{ marginBottom: 48 }}>
            <h2 id={`faq-group-${g}`} style={{ ...display, fontSize: 22, fontWeight: 600, color: tone.fg, margin: "0 0 12px" }}>
              {group.title}
            </h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${tone.border}` }}>
              {group.items.map((f) => (
                <li key={f.slug} style={{ borderBottom: `1px solid ${tone.border}` }}>
                  <Link
                    to={faqPath(f)}
                    className="tf-faq-row"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "18px 8px", textDecoration: "none", color: tone.fg }}
                  >
                    <span style={{ ...display, fontSize: 17, fontWeight: 600 }}>{f.q}</span>
                    <ChevronRight size={18} color="var(--muted)" aria-hidden="true" style={{ flexShrink: 0 }} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section
          aria-labelledby="faq-more"
          style={{ textAlign: "center", border: `1px solid ${tone.border}`, borderRadius: 16, background: tone.card, padding: "32px 24px" }}
        >
          <h2 id="faq-more" style={{ ...display, fontSize: 20, fontWeight: 600, color: tone.fg, margin: "0 0 8px" }}>Still have a question?</h2>
          <p style={{ fontSize: 15, color: tone.muted, margin: "0 0 20px" }}>Email info@unimisk.com and we will get back to you.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Button to="/contact" style={{ paddingLeft: 32, paddingRight: 32 }}>Contact us</Button>
            <Button variant="outline" to="/pricing" style={{ paddingLeft: 32, paddingRight: 32 }}>See pricing</Button>
          </div>
        </section>
        <PageLinks path="/faq" />
      </Container>
    </PageShell>
  );
}
