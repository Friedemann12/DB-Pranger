"use client";

import { ReactNode } from "react";
import { GlassCard } from "./ui/GlassCard";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  status?: "good" | "warning" | "critical" | "neutral";
  loading?: boolean;
}

const statusColors = {
  good: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
  neutral: "text-cyan-400",
};

const statusGlow = {
  good: "shadow-emerald-500/20",
  warning: "shadow-amber-500/20",
  critical: "shadow-red-500/20",
  neutral: "shadow-cyan-500/20",
};

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  status = "neutral",
  loading = false,
}: KPICardProps) {
  if (loading) {
    return (
      <GlassCard variant="default" className="animate-fade-in">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="skeleton h-4 w-24 rounded mb-3" />
            <div className="skeleton h-8 w-32 rounded mb-2" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
          <div className="skeleton h-10 w-10 rounded-xl" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard 
      variant="default" 
      hover 
      className={`animate-slide-up shadow-lg ${statusGlow[status]}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted font-medium mb-1">{title}</p>
          <p className={`text-3xl font-bold ${statusColors[status]} tracking-tight`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-xs font-medium ${
                  trend.value >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-muted">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`p-2.5 rounded-xl bg-white/5 ${statusColors[status]}`}>
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// Mini version for inline stats
interface MiniKPIProps {
  label: string;
  value: string | number;
  status?: "good" | "warning" | "critical" | "neutral";
}

export function MiniKPI({ label, value, status = "neutral" }: MiniKPIProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm font-semibold ${statusColors[status]}`}>
        {value}
      </span>
    </div>
  );
}

