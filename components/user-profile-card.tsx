import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/roles";

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function UserProfileCard({
  userName,
  role,
  compact = false,
  className,
}: {
  userName?: string | null;
  role?: string;
  compact?: boolean;
  className?: string;
}) {
  if (!userName) return null;

  const initials = getInitials(userName);
  const roleLabel = role ? ROLE_LABELS[role] ?? role : undefined;

  return (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      <div className="relative shrink-0">
        <div
          className={cn(
            "rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold",
            compact ? "w-8 h-8 text-xs" : "w-9 h-9 text-sm"
          )}
        >
          {initials}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{userName}</p>
        {!compact && roleLabel && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {roleLabel}
          </p>
        )}
      </div>
    </div>
  );
}
