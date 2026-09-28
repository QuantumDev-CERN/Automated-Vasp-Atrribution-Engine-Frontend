"use client";

import { useEffect, useState } from "react";

/** Live IST clock. Top bar shows HH:MM IST; status bar shows HH:MM:SS IST. */
export function Clock({ seconds = false, className = "clock" }: { seconds?: boolean; className?: string }) {
  // Render nothing until mounted: the server snapshot would always be a
  // second (or more) stale by hydration time, causing a hydration mismatch.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hour12: false,
  });
  return (
    <span className={className}>
      {now ? `${fmt.format(now)} IST` : "—"}
    </span>
  );
}
