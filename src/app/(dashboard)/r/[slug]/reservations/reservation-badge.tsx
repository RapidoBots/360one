import type { ReservationStatus } from "@/generated/prisma/client";

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  SEATED: "Seated",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

// bg/text/bar triplets from the Reservations redesign spec -- shared by the
// toolbar's status chips, all three calendar views, and the details panel.
export const STATUS_COLORS: Record<ReservationStatus, { bg: string; text: string; bar: string }> = {
  PENDING: { bg: "#F3E8FF", text: "#7E22CE", bar: "#A855F7" },
  CONFIRMED: { bg: "#DBEAFE", text: "#1D4ED8", bar: "#3B82F6" },
  SEATED: { bg: "#D1FAE5", text: "#047857", bar: "#10B981" },
  COMPLETED: { bg: "#F1F5F9", text: "#475569", bar: "#94A3B8" },
  CANCELLED: { bg: "#FEE2E2", text: "#B91C1C", bar: "#EF4444" },
  NO_SHOW: { bg: "#FFEDD5", text: "#C2410C", bar: "#F97316" },
};

export function ReservationBadge({ status }: { status: ReservationStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: c.bar }} />
      {STATUS_LABELS[status]}
    </span>
  );
}
