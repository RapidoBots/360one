import { Badge } from "@/components/ui/badge";
import type { ReservationStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

export const STATUS_STYLES: Record<ReservationStatus, string> = {
  CONFIRMED: "bg-primary/10 text-primary",
  SEATED: "bg-emerald-500/10 text-emerald-600",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
  NO_SHOW: "bg-amber-500/10 text-amber-600",
};

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  CONFIRMED: "Confirmed",
  SEATED: "Seated",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

// Left-border accent color for the Timeline view's reservation cards.
export const STATUS_ACCENT: Record<ReservationStatus, string> = {
  CONFIRMED: "border-l-primary",
  SEATED: "border-l-emerald-500",
  COMPLETED: "border-l-muted-foreground",
  CANCELLED: "border-l-destructive",
  NO_SHOW: "border-l-amber-500",
};

export function ReservationBadge({ status }: { status: ReservationStatus }) {
  return (
    <Badge className={cn("font-medium", STATUS_STYLES[status])} variant="outline">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
