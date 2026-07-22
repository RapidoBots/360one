import { Badge } from "@/components/ui/badge";
import type { RestaurantStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<RestaurantStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600",
  SUSPENDED: "bg-destructive/10 text-destructive",
};

const STATUS_LABELS: Record<RestaurantStatus, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
};

export function RestaurantStatusBadge({ status }: { status: RestaurantStatus }) {
  return (
    <Badge className={cn("font-medium", STATUS_STYLES[status])} variant="outline">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
