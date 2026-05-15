import * as React from "react";
import { cn } from "@/src/lib/utils";

/**
 * Shared layout primitives that keep every landing page on a single visual
 * grid — same max-width, same horizontal padding, same vertical rhythm.
 * Any new page should compose with these instead of redefining margins.
 */

type PageProps = {
  className?: string;
  children: React.ReactNode;
};

/** Top-level wrapper: pushes content below the fixed Navbar and adds bottom rhythm. */
export function PageShell({ className, children }: PageProps) {
  return <div className={cn("pt-28 lg:pt-32 pb-24 font-sans", className)}>{children}</div>;
}

type ContainerProps = PageProps & {
  /** Default 6xl (1152px); use "5xl" for prose-style pages, "7xl" for full bento. */
  width?: "5xl" | "6xl" | "7xl";
};

export function Container({ className, children, width = "6xl" }: ContainerProps) {
  const max =
    width === "5xl" ? "max-w-5xl" :
    width === "7xl" ? "max-w-7xl" :
    "max-w-6xl";
  return <div className={cn(max, "mx-auto px-6", className)}>{children}</div>;
}

type SectionProps = PageProps & {
  /** Tighter for content-heavy pages, looser for marketing reveals. */
  pad?: "tight" | "default" | "loose";
};

export function Section({ className, children, pad = "default" }: SectionProps) {
  const v =
    pad === "tight" ? "py-16 lg:py-20" :
    pad === "loose" ? "py-24 lg:py-32" :
    "py-20 lg:py-28";
  return <section className={cn(v, className)}>{children}</section>;
}

/** Standard eyebrow used above every page/section title. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-[0.16em] uppercase text-brand-primary/80">
      {children}
    </p>
  );
}

type PageHeaderProps = {
  eyebrow?: string;
  title: React.ReactNode;
  blurb?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
};

/** Page-level header (eyebrow + h1 + lead). Drop at the top of every page. */
export function PageHeader({ eyebrow, title, blurb, align = "center", className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "space-y-5 mb-16 lg:mb-20",
        align === "center" ? "text-center max-w-3xl mx-auto" : "max-w-3xl",
        className,
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="font-display text-4xl lg:text-6xl font-semibold tracking-[-0.03em] leading-[1.05] text-[var(--foreground)]">
        {title}
      </h1>
      {blurb && (
        <p className="text-base lg:text-lg text-[var(--muted)] leading-relaxed">{blurb}</p>
      )}
    </header>
  );
}

type SectionHeadProps = {
  eyebrow?: string;
  title: React.ReactNode;
  blurb?: React.ReactNode;
  align?: "left" | "center";
};

/** Mid-page section title. */
export function SectionHead({ eyebrow, title, blurb, align = "center" }: SectionHeadProps) {
  return (
    <div className={cn(
      "space-y-4 mb-12 lg:mb-14",
      align === "center" ? "text-center max-w-2xl mx-auto" : "max-w-2xl",
    )}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em] leading-[1.1] text-[var(--foreground)]">
        {title}
      </h2>
      {blurb && (
        <p className="text-base text-[var(--muted)] leading-relaxed">{blurb}</p>
      )}
    </div>
  );
}

/** Dark, gradient-tinted CTA panel used at the bottom of most pages. */
export function CtaPanel({
  title,
  blurb,
  children,
}: {
  title: React.ReactNode;
  blurb?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden bg-slate-950 border border-white/10 rounded-3xl p-10 lg:p-16 text-center shadow-[0_40px_80px_-40px_rgba(15,23,42,0.40)]">
      <div className="absolute -top-24 -left-24 size-80 bg-brand-primary/20 rounded-full blur-3xl opacity-60" />
      <div className="absolute -bottom-24 -right-24 size-80 bg-brand-accent/20 rounded-full blur-3xl opacity-60" />
      <div className="relative space-y-5">
        <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.03em] leading-[1.05] text-white">
          {title}
        </h2>
        {blurb && (
          <p className="text-base text-slate-400 max-w-xl mx-auto leading-relaxed">{blurb}</p>
        )}
      </div>
      <div className="relative mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        {children}
      </div>
    </div>
  );
}
