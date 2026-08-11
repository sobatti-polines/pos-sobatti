"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function Highlight({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const q = query.trim();
  if (!q || !text) return <>{text}</>;

  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let start = 0;

  while (true) {
    const idx = lower.indexOf(qLower, start);
    if (idx === -1) break;
    if (idx > start) {
      parts.push(text.slice(start, idx));
    }
    parts.push(
      <mark
        key={idx}
        className={cn(
          "bg-primary/15 text-foreground rounded-[3px] px-0.5 font-semibold",
          className
        )}
      >
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    start = idx + q.length;
  }

  if (start < text.length) {
    parts.push(text.slice(start));
  }

  return <>{parts}</>;
}
