import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/Button";
import { PageShell, Container, tone, display } from "../lib/ui";
import { ALL_FAQS, FAQ_GROUPS, faqPath } from "../../seo/faqContent.js";
import Seo from "../../seo/Seo";

/** One FAQ question on its own page: the answer in full, a back button to the list and the other questions from the same topic. */
export default function FaqQuestion({ slug }: { slug: string }) {
  const item = ALL_FAQS.find((f) => f.slug === slug);
  if (!item) return null;
  const group = FAQ_GROUPS.find((g) => g.title === item.group);
  const related = (group?.items || []).filter((f) => f.slug !== item.slug);

  return (
    <PageShell>
      <Seo path={faqPath(item)} route={null} />
      <Container width={760}>
        <Button variant="outline" size="sm" to="/faq" style={{ marginBottom: 32 }}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to all questions
        </Button>

        <article>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B5CF6", margin: "0 0 12px" }}>
            FAQ · {item.group}
          </p>
          <h1 style={{ ...display, fontSize: "clamp(28px, 4.5vw, 44px)", fontWeight: 600, lineHeight: 1.12, margin: "0 0 24px", color: tone.fg }}>
            {item.q}
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.7, color: tone.muted, margin: 0 }}>{item.a}</p>
        </article>

        {related.length > 0 && (
          <aside aria-labelledby="faq-related" style={{ marginTop: 56 }}>
            <h2 id="faq-related" style={{ ...display, fontSize: 20, fontWeight: 600, color: tone.fg, margin: "0 0 12px" }}>More in {item.group}</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${tone.border}` }}>
              {related.map((f) => (
                <li key={f.slug} style={{ borderBottom: `1px solid ${tone.border}` }}>
                  <Link to={faqPath(f)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "14px 4px", textDecoration: "none", color: tone.fg, fontSize: 16, fontWeight: 500 }}>
                    <span>{f.q}</span>
                    <ChevronRight size={16} color="var(--muted)" aria-hidden="true" style={{ flexShrink: 0 }} />
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <section
          aria-labelledby="faq-ask"
          style={{ marginTop: 48, textAlign: "center", border: `1px solid ${tone.border}`, borderRadius: 16, background: tone.card, padding: "28px 24px" }}
        >
          <h2 id="faq-ask" style={{ ...display, fontSize: 20, fontWeight: 600, color: tone.fg, margin: "0 0 8px" }}>Still have a question?</h2>
          <p style={{ fontSize: 15, color: tone.muted, margin: "0 0 20px" }}>Email info@unimisk.com and we will get back to you.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Button to="/contact" style={{ paddingLeft: 32, paddingRight: 32 }}>Contact us</Button>
            <Button variant="outline" to="/faq" style={{ paddingLeft: 32, paddingRight: 32 }}>All questions</Button>
          </div>
        </section>
      </Container>
    </PageShell>
  );
}
