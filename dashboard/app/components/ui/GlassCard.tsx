"use client";

import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "subtle" | "strong" | "glow";
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const variantClasses = {
  default: "glass",
  subtle: "glass-subtle",
  strong: "glass-strong",
  glow: "glass glass-glow",
};

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function GlassCard({
  children,
  className = "",
  variant = "default",
  hover = false,
  padding = "md",
}: GlassCardProps) {
  const baseClasses = variantClasses[variant];
  const paddingClass = paddingClasses[padding];
  const hoverClasses = hover ? "transition-all-200 hover-lift cursor-pointer" : "";

  return (
    <div className={`${baseClasses} ${paddingClass} ${hoverClasses} ${className}`}>
      {children}
    </div>
  );
}

// Header variant for section titles
interface GlassCardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function GlassCardHeader({ title, subtitle, action }: GlassCardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-sm text-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

