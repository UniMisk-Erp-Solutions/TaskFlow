import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { Link, type LinkProps } from "react-router-dom";
import { cn } from "@/src/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:shadow-xl hover:shadow-brand-primary/30",
  secondary:
    "bg-brand-accent text-white shadow-lg shadow-brand-accent/20 hover:shadow-xl hover:shadow-brand-accent/30",
  outline:
    "border-2 border-[var(--border)] bg-transparent hover:bg-[var(--accent)] text-[var(--foreground)]",
  ghost: "bg-transparent hover:bg-[var(--accent)] text-[var(--foreground)]",
};

const sizes: Record<Size, string> = {
  sm: "px-5 py-2 text-sm",
  md: "px-7 py-3 text-base",
  lg: "px-10 py-4 text-lg font-semibold",
};

const baseClasses =
  "inline-flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

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
