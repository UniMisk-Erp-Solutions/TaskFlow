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
        "rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 transition-all duration-500",
        "shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none",
        hover && "hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-none hover:border-brand-primary/20",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};
