import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { PageShell, Container, PageHeader, CtaPanel, BRAND, tone, display } from '../lib/ui';
import { LANDING_PAGES, BLOG_POSTS, blogPath } from '../../seo/seoPages.js';
import { getRoute } from '../../seo/schema.js';
import Seo from '../../seo/Seo';

export const proseStyle = { fontSize: 17, lineHeight: 1.7, color: tone.muted, margin: '0 0 16px' };
export const h2Style = { ...display, fontSize: 'clamp(24px, 3.2vw, 32px)', fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.02em', color: tone.fg, margin: '0 0 16px' };

export function Breadcrumbs({ trail }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: 14, color: tone.muted, marginBottom: 24 }}>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {trail.map((item, i) => (
          <li key={item.to || item.label} style={{ display: 'inline-flex', gap: 8 }}>
            {item.to ? <Link to={item.to} style={{ color: tone.muted, textDecoration: 'underline' }}>{item.label}</Link> : <span aria-current="page" style={{ color: tone.fg }}>{item.label}</span>}
            {i < trail.length - 1 && <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ContentSections({ sections }) {
  return sections.map((section) => (
    <section key={section.h2} style={{ margin: '48px 0 0' }}>
      <h2 style={h2Style}>{section.h2}</h2>
      {section.paragraphs?.map((p) => <p key={p.slice(0, 40)} style={proseStyle}>{p}</p>)}
      {section.bullets && (
        <ul style={{ ...proseStyle, paddingLeft: 22, display: 'grid', gap: 8, listStyleType: 'disc' }}>
          {section.bullets.map((b) => <li key={b}>{b}</li>)}
        </ul>
      )}
      {section.note && <p style={{ ...proseStyle, fontSize: 14, fontStyle: 'italic' }}>{section.note}</p>}
    </section>
  ));
}

export function RelatedLinks({ paths }) {
  const items = paths
    .map((path) => {
      const landing = LANDING_PAGES.find((p) => p.path === path);
      if (landing) return { to: path, label: landing.h1 };
      const post = BLOG_POSTS.find((p) => blogPath(p.slug) === path);
      return post ? { to: path, label: post.title } : null;
    })
    .filter(Boolean);
  if (!items.length) return null;
  return (
    <aside aria-labelledby="related-heading" style={{ margin: '56px 0 0' }}>
      <h2 id="related-heading" style={h2Style}>Keep reading</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
        {items.map((item) => (
          <li key={item.to}>
            <Link to={item.to} style={{ color: BRAND, fontWeight: 600, fontSize: 17, textDecoration: 'none' }}>{item.label} →</Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function ClosingCta({ title = 'Try TaskFlow with your team' }) {
  return (
    <div style={{ marginTop: 64 }}>
      <CtaPanel title={title}>
        <Button size="lg" to="/login?mode=signup">Start free</Button>
        <Button size="lg" to="/pricing" variant="outline" className="border-white/20 text-white hover:bg-white/10">View pricing</Button>
      </CtaPanel>
    </div>
  );
}

/** One search landing page, driven by the content in seo/seoPages.js. */
export default function SeoLanding({ path }) {
  const page = LANDING_PAGES.find((p) => p.path === path);
  if (!page) return null;
  return (
    <PageShell>
      <Seo route={getRoute(path)} />
      <Container width={820}>
        <Breadcrumbs trail={[{ label: 'Home', to: '/' }, { label: page.eyebrow }]} />
        <PageHeader eyebrow={page.eyebrow} title={page.h1} align="left" />
        <div style={{ marginTop: -40 }}>
          {page.intro.map((p) => <p key={p.slice(0, 40)} style={proseStyle}>{p}</p>)}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '24px 0 0' }}>
          <Button size="md" to="/login?mode=signup">Start free</Button>
          <Button size="md" to="/features" variant="outline">See all features</Button>
        </div>

        <ContentSections sections={page.sections} />

        <section style={{ margin: '56px 0 0' }} aria-labelledby="faq-heading">
          <h2 id="faq-heading" style={h2Style}>Frequently asked questions</h2>
          <dl style={{ margin: 0, display: 'grid', gap: 20 }}>
            {page.faqs.map((f) => (
              <div key={f.q}>
                <dt style={{ fontWeight: 600, fontSize: 18, color: tone.fg, marginBottom: 6 }}>{f.q}</dt>
                <dd style={{ ...proseStyle, margin: 0 }}>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <RelatedLinks paths={page.related} />
        <ClosingCta />
      </Container>
    </PageShell>
  );
}

