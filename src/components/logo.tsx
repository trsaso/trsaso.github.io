import { HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber text-amber-foreground">
        <HardHat className="h-5 w-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="text-lg font-bold tracking-tight">
          QuarryProof <span className="text-amber">AI</span>
        </span>
      )}
    </span>
  );
}
