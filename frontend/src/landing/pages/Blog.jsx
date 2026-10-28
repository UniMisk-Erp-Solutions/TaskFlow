import { Link } from 'react-router-dom';
import { PageShell, Container, PageHeader, BRAND, tone, display } from '../lib/ui';
import { BLOG_POSTS, BLOG_INDEX, blogPath } from '../../seo/seoPages.js';
import { getRoute } from '../../seo/schema.js';
import Seo from '../../seo/Seo';
import { Breadcrumbs, ContentSections, RelatedLinks, ClosingCta, proseStyle } from './SeoLanding';

const formatDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export function BlogIndex() {
  return (
    <PageShell>
      <Seo route={getRoute('/blog')} />
      <Container width={820}>
        <Breadcrumbs trail={[{ label: 'Home', to: '/' }, { label: 'Blog' }]} />
        <PageHeader eyebrow="Blog" title={BLOG_INDEX.h1} blurb={BLOG_INDEX.intro} align="left" />
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 20 }}>
          {BLOG_POSTS.map((post) => (
            <li key={post.slug}>
              <article style={{ border: `1px solid ${tone.border}`, background: tone.card, borderRadius: 16, padding: 24 }}>
                <h2 style={{ ...display, fontSize: 22, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                  <Link to={blogPath(post.slug)} style={{ color: tone.fg, textDecoration: 'none' }}>{post.title}</Link>
                </h2>
                <p style={{ ...proseStyle, margin: '0 0 12px' }}>{post.description}</p>
                <p style={{ fontSize: 14, color: tone.muted, margin: 0 }}>
                  <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.readMinutes} min read ·{' '}
                  <Link to={blogPath(post.slug)} style={{ color: BRAND, fontWeight: 600, textDecoration: 'none' }}>Read the guide →</Link>
                </p>
              </article>
            </li>
          ))}
        </ul>
        <ClosingCta />
      </Container>
    </PageShell>
  );
}

export default function BlogPost({ slug }) {
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return null;
  const path = blogPath(slug);
  return (
    <PageShell>
      <Seo route={getRoute(path)} />
      <Container width={760}>
        <Breadcrumbs trail={[{ label: 'Home', to: '/' }, { label: 'Blog', to: '/blog' }, { label: post.title }]} />
        <article>
          <PageHeader title={post.title} align="left" />
          <p style={{ fontSize: 14, color: tone.muted, margin: '-40px 0 24px' }}>
            By TaskFlow · <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.readMinutes} min read
          </p>
          <p style={{ ...proseStyle, fontSize: 19, color: tone.fg }}>{post.intro}</p>
          <ContentSections sections={post.sections} />
        </article>
        <RelatedLinks paths={post.related} />
        <ClosingCta title="Put these ideas to work in TaskFlow" />
      </Container>
    </PageShell>
  );
}
