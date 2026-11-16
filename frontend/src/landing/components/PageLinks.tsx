import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { tone, display } from "../lib/ui";
import { PAGE_LINKS } from "../lib/pageLinks.js";

/** "Related pages" for a company, legal or help page: each link says what the visitor will find there. */
export default function PageLinks({ path, title = "Related pages" }: { path: string; title?: string }) {
  const links: { to: string; label: string; blurb?: string }[] | undefined = PAGE_LINKS[path as keyof typeof PAGE_LINKS];
  if (!links || links.length === 0) return null;
  const headingId = `related-pages-${path.replace(/\W+/g, "-")}`;
  return (
    <nav aria-labelledby={headingId} style={{ margin: "72px auto 0", maxWidth: 820 }}>
      <h2 id={headingId} style={{ ...display, fontSize: 22, fontWeight: 600, color: tone.fg, margin: "0 0 16px" }}>{title}</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%", boxSizing: "border-box", padding: 18, borderRadius: 14, textDecoration: "none", background: tone.card, border: `1px solid ${tone.border}` }}
            >
              <span style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, color: tone.fg, fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>
                <span>{l.label}</span>
                <ArrowRight size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3, color: tone.muted }} />
              </span>
              {l.blurb && <span style={{ color: tone.muted, fontSize: 13, lineHeight: 1.5 }}>{l.blurb}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
