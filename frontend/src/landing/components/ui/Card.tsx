import * as React from "react";
import { cn } from "@/src/lib/utils";
import { motion } from "motion/react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card = ({ className, children, hover = true, ...props }: CardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-7 transition-all duration-300",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)] dark:shadow-none",
        hover && "hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06),0_24px_48px_-20px_rgba(15,23,42,0.16)] dark:hover:shadow-none hover:border-brand-primary/30",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};
