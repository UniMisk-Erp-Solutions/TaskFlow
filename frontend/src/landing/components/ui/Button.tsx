import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { Link, type LinkProps } from "react-router-dom";
import { cn } from "@/src/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-primary text-white shadow-[0_10px_28px_-10px_rgba(139,92,246,0.55)] hover:shadow-[0_14px_32px_-12px_rgba(139,92,246,0.65)] hover:brightness-[1.05]",
  secondary:
    "bg-brand-accent text-white shadow-[0_10px_28px_-10px_rgba(192,132,252,0.55)] hover:shadow-[0_14px_32px_-12px_rgba(192,132,252,0.65)] hover:brightness-[1.05]",
  outline:
    "border border-[var(--border)] bg-transparent hover:bg-[var(--accent)] text-[var(--foreground)] hover:border-brand-primary/40",
  ghost: "bg-transparent hover:bg-[var(--accent)] text-[var(--foreground)]",
};

// All sizes intentionally use a minimum height + generous horizontal padding
// so buttons sit with real presence on the page (and the lg variant matches
// the visual weight of section headings on the marketing pages).
const sizes: Record<Size, string> = {
  sm: "h-10 px-5 text-sm font-medium",
  md: "h-12 px-7 text-[15px] font-semibold",
  lg: "h-14 px-9 text-base font-semibold min-w-[180px]",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-full whitespace-nowrap transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer tracking-tight";

interface ButtonAsButtonProps extends HTMLMotionProps<"button"> {
  variant?: Variant;
  size?: Size;
  to?: undefined;
}

interface ButtonAsLinkProps extends Omit<LinkProps, "className"> {
  variant?: Variant;
  size?: Size;
  to: LinkProps["to"];
  className?: string;
  children?: React.ReactNode;
}

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

/**
 * Marketing Button. Renders a styled <Link> when a `to` prop is provided
 * (lets us hook CTAs straight into the real auth/marketing routes without
 * relying on imperative `useNavigate` calls in every page). Falls back to
 * the original animated <motion.button> otherwise.
 */
export const Button = React.forwardRef<HTMLElement, ButtonProps>(
  (props, ref) => {
    const { className, variant = "primary", size = "md" } = props as {
      className?: string;
      variant?: Variant;
      size?: Size;
    };

    const composedClassName = cn(baseClasses, variants[variant], sizes[size], className);

    if ("to" in props && props.to !== undefined) {
      const { to, children, variant: _v, size: _s, className: _c, ...rest } = props as ButtonAsLinkProps;
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          to={to}
          className={composedClassName}
          {...rest}
        >
          {children}
        </Link>
      );
    }

    const { variant: _v, size: _s, className: _c, ...rest } = props as ButtonAsButtonProps;
    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={composedClassName}
        {...rest}
      />
    );
  }
);

Button.displayName = "Button";
