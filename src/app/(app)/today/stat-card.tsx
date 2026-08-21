import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Tone = "neutral" | "amber" | "hazard" | "success";

const TONE_ICON_CLASSES: Record<Tone, string> = {
  neutral: "bg-secondary text-foreground",
  amber: "bg-amber/15 text-amber",
  hazard: "bg-hazard/10 text-hazard",
  success: "bg-success/10 text-success",
};

const TONE_TEXT: Record<Tone, string | null> = {
  neutral: null,
  amber: "Needs review",
  hazard: "Attention",
  success: "All clear",
};

/**
 * Dashboard stat tile. Status is conveyed with text + icon, never color
 * alone; the whole tile is a link when a destination exists.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  tone = "neutral",
  srHint,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  href?: string;
  tone?: Tone;
  srHint?: string;
}) {
  const body = (
    <CardContent className="flex items-start justify-between gap-2 p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
        {TONE_TEXT[tone] && (
          <p
            className={cn(
              "mt-0.5 text-xs font-semibold uppercase tracking-wide",
              tone === "hazard" && "text-hazard",
              tone === "amber" && "text-amber",
              tone === "success" && "text-success"
            )}
          >
            {TONE_TEXT[tone]}
          </p>
        )}
        {srHint && <span className="sr-only">{srHint}</span>}
      </div>
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
          TONE_ICON_CLASSES[tone]
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </CardContent>
  );

  if (href) {
    return (
      <Card className="transition-colors hover:border-input focus-within:ring-2 focus-within:ring-ring">
        <Link
          href={href}
          className="block focus-visible:outline-none"
          aria-label={`${label}: ${value}${srHint ? ` — ${srHint}` : ""}`}
        >
          {body}
        </Link>
      </Card>
    );
  }

  return <Card>{body}</Card>;
}
