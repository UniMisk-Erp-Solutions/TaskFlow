import { PageShell, Container, PageHeader, BRAND, tone, display } from "../lib/ui";
import PageLinks from "../components/PageLinks";
import { LEGAL_PAGES, LEGAL_CONTACT, LEGAL_UPDATED } from "../lib/legalPages.js";

type Section = { title: string; paragraphs?: string[]; bullets?: string[] };
type Page = { path: string; h1: string; blurb: string; sections: Section[] };

/** One policy page (refunds, cookies, acceptable use, grievances, disclaimer), driven by landing/lib/legalPages.js. */
export default function LegalPage({ path }: { path: string }) {
  const page = (LEGAL_PAGES as Page[]).find((p) => p.path === path);
  if (!page) return null;
  const prose = { fontSize: 16, lineHeight: 1.65, color: tone.muted, margin: 0 } as const;
  return (
    <PageShell>
      <Container width={960}>
        <PageHeader
          eyebrow="Legal"
          title={page.h1}
          blurb={<>{page.blurb} · Updated {LEGAL_UPDATED}.</>}
          align="left"
        />
        <article style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {page.sections.map((s) => (
            <section key={s.title} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 style={{ ...display, fontSize: 22, fontWeight: 600, margin: 0, color: tone.fg }}>{s.title}</h2>
              {s.paragraphs?.map((p) => <p key={p.slice(0, 40)} style={prose}>{p}</p>)}
              {s.bullets && (
                <ul style={{ ...prose, paddingLeft: 22, display: "grid", gap: 8, listStyleType: "disc" }}>
                  {s.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
              )}
            </section>
          ))}
          <div style={{ paddingTop: 28, borderTop: `1px solid ${tone.border}`, fontSize: 14, color: tone.muted, display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ margin: 0 }}>
              Questions? Contact us at{" "}
              <a href={`mailto:${LEGAL_CONTACT}`} style={{ color: BRAND, textDecoration: "underline" }}>{LEGAL_CONTACT}</a>.
            </p>
            <p style={{ margin: 0 }}>© {new Date().getFullYear()} TaskFlow. All rights reserved.</p>
          </div>
        </article>
        <PageLinks path={page.path} />
      </Container>
    </PageShell>
  );
}
