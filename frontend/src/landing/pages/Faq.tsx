import { ChevronDown } from "lucide-react";
import { Button } from "../components/ui/Button";
import { PageShell, Container, PageHeader, tone, display } from "../lib/ui";
import { FAQ_GROUPS } from "../../seo/faqContent.js";

/**
 * Full FAQ page. Native <details> accordions: keyboard and screen-reader friendly, and every answer is in the page HTML.
 * (No FAQ structured data: Google only shows FAQ rich results for government and health sites.)
 */
export default function Faq() {
  return (
    <PageShell>
      <style>{".tf-faq summary::-webkit-details-marker{display:none}.tf-faq summary svg{transition:transform .2s}.tf-faq[open] summary svg{transform:rotate(180deg)}.tf-faq summary:focus-visible{outline:2px solid #8B5CF6;outline-offset:4px;border-radius:4px}"}</style>
      <Container width={820}>
        <PageHeader
          eyebrow="FAQ"
          title="Frequently asked questions"
          blurb="Straight answers about what TaskFlow does, how plans work and how to get started."
        />

        {FAQ_GROUPS.map((group, g) => (
          <section key={group.title} aria-labelledby={`faq-group-${g}`} style={{ marginBottom: 48 }}>
            <h2 id={`faq-group-${g}`} style={{ ...display, fontSize: 22, fontWeight: 600, color: tone.fg, margin: "0 0 12px" }}>
              {group.title}
            </h2>
            <div style={{ borderTop: `1px solid ${tone.border}`, borderBottom: `1px solid ${tone.border}` }}>
              {group.items.map((f, i) => (
                <details
                  key={f.q}
                  className="tf-faq"
                  style={{ padding: "20px 0", borderBottom: i !== group.items.length - 1 ? `1px solid ${tone.border}` : "none" }}
                >
                  <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                    <h3 style={{ ...display, fontSize: 17, fontWeight: 600, margin: 0, color: tone.fg }}>{f.q}</h3>
                    <ChevronDown size={18} color="var(--muted)" aria-hidden="true" style={{ flexShrink: 0 }} />
                  </summary>
                  <p style={{ fontSize: 15, lineHeight: 1.65, color: tone.muted, margin: "12px 0 0" }}>{f.a}</p>
                </details>
              ))}
            </div>
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
      </Container>
    </PageShell>
  );
}
