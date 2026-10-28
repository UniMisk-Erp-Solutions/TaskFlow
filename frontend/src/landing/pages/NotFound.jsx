import { Link } from 'react-router-dom';
import { PageShell, Container, PageHeader, BRAND, tone } from '../lib/ui';
import Seo from '../../seo/Seo';

const route = {
  path: '/404',
  title: 'Page not found | TaskFlow',
  description: 'This page does not exist. Go back to the TaskFlow home page.',
  noindex: true,
};

/** Unknown URLs used to bounce silently to the home page, which search engines treat as duplicate content. */
export default function NotFound() {
  return (
    <PageShell>
      <Seo route={route} />
      <Container width={720}>
        <PageHeader eyebrow="404" title="We could not find that page" blurb="The link may be old or mistyped. Try one of these instead." />
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 auto', display: 'grid', gap: 12, textAlign: 'center' }}>
          {[['/', 'Home'], ['/features', 'Features'], ['/pricing', 'Pricing'], ['/blog', 'Blog'], ['/contact', 'Contact us']].map(([to, label]) => (
            <li key={to}><Link to={to} style={{ color: BRAND, fontWeight: 600, fontSize: 17, textDecoration: 'none' }}>{label}</Link></li>
          ))}
        </ul>
        <p style={{ textAlign: 'center', color: tone.muted, marginTop: 32 }}>
          Looking for your workspace? <Link to="/login" style={{ color: BRAND }}>Sign in</Link>.
        </p>
      </Container>
    </PageShell>
  );
}
