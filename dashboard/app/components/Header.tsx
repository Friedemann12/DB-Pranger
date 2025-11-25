"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface HeaderProps {
  apiStatus?: "healthy" | "unhealthy" | "loading";
}

export function Header({ apiStatus = "loading" }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleString("de-DE", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const statusConfig = {
    healthy: {
      color: "bg-emerald-500",
      text: "text-emerald-400",
      label: "Connected",
    },
    unhealthy: {
      color: "bg-red-500",
      text: "text-red-400",
      label: "Disconnected",
    },
    loading: {
      color: "bg-amber-500",
      text: "text-amber-400",
      label: "Connecting...",
    },
  };

  const status = statusConfig[apiStatus];

  return (
    <header className="glass-subtle sticky top-0 z-50 px-6 py-4 mb-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/db_pranger.png"
              alt="DB Pranger Logo"
              width={48}
              height={48}
              className="rounded-lg"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                DB <span className="text-gradient">Pranger</span>
              </h1>
              <p className="text-xs text-muted">Hamburg Transit Delay Tracker</p>
            </div>
          </div>
        </div>

        {/* Status & Time */}
        <div className="flex items-center gap-6">
          {/* API Status */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {apiStatus === "healthy" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${status.color}`} />
            </span>
            <span className={`text-sm font-medium ${status.text}`}>
              {status.label}
            </span>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-white/10" />

          {/* Current Time */}
          <div className="text-right">
            <p className="text-sm font-mono text-foreground">{currentTime}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

